import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from "axios";
import { API_BASE_URL, DEFAULT_TIMEOUT } from "../constants.js";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export interface ApiError {
  status: number;
  message: string;
  details?: string;
}

export class PolarApiClient {
  private client: AxiosInstance;
  private accessToken: string;
  private userId: string;

  constructor() {
    const accessToken = process.env.POLAR_ACCESS_TOKEN;
    const userId = process.env.POLAR_USER_ID;

    if (!accessToken) {
      throw new Error("POLAR_ACCESS_TOKEN environment variable is required");
    }
    if (!userId) {
      throw new Error("POLAR_USER_ID environment variable is required");
    }

    this.accessToken = accessToken;
    this.userId = userId;

    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: DEFAULT_TIMEOUT,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  }

  getUserId(): string {
    return this.userId;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getRetryDelay(error: AxiosError, attempt: number): number {
    const retryAfter = error.response?.headers?.["retry-after"];
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        return seconds * 1000;
      }
    }
    return BASE_DELAY_MS * Math.pow(2, attempt);
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: AxiosError | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const axiosError = error as AxiosError;

        if (axiosError.response?.status === 429 && attempt < MAX_RETRIES) {
          lastError = axiosError;
          const delay = this.getRetryDelay(axiosError, attempt);
          console.error(
            `Rate limited on ${context}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
          );
          await this.sleep(delay);
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }

  private handleError(error: AxiosError): ApiError {
    if (error.response) {
      const status = error.response.status;
      let message: string;

      switch (status) {
        case 401:
          message = "Unauthorized: Invalid or expired access token. Please re-authenticate using the OAuth flow.";
          break;
        case 403:
          message = "Forbidden: Access denied. This usually means: (1) User not registered - call polar_register_user first, (2) User hasn't accepted required consents in Polar Flow app, or (3) The endpoint requires different permissions.";
          break;
        case 404:
          message = "Not found: The requested resource does not exist";
          break;
        case 429:
          message = "Rate limited: Too many requests, please try again later";
          break;
        case 500:
          message = "Server error: Polar API internal error";
          break;
        default:
          message = `HTTP ${status}: ${error.message}`;
      }

      return {
        status,
        message,
        details: JSON.stringify(error.response.data),
      };
    }

    if (error.code === "ECONNABORTED") {
      return {
        status: 408,
        message: "Request timeout: The request took too long to complete",
      };
    }

    return {
      status: 0,
      message: `Network error: ${error.message}`,
    };
  }

  async get<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    try {
      return await this.withRetry(async () => {
        const response = await this.client.get<T>(endpoint, { params });
        return response.data;
      }, `GET ${endpoint}`);
    } catch (error) {
      const apiError = this.handleError(error as AxiosError);
      throw new Error(`${apiError.message}${apiError.details ? ` - ${apiError.details}` : ""}`);
    }
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    try {
      return await this.withRetry(async () => {
        const response = await this.client.post<T>(endpoint, data);
        return response.data;
      }, `POST ${endpoint}`);
    } catch (error) {
      const apiError = this.handleError(error as AxiosError);
      throw new Error(`${apiError.message}${apiError.details ? ` - ${apiError.details}` : ""}`);
    }
  }

  async delete(endpoint: string): Promise<void> {
    try {
      await this.withRetry(async () => {
        await this.client.delete(endpoint);
      }, `DELETE ${endpoint}`);
    } catch (error) {
      const apiError = this.handleError(error as AxiosError);
      throw new Error(`${apiError.message}${apiError.details ? ` - ${apiError.details}` : ""}`);
    }
  }

  async getBinary(endpoint: string): Promise<Buffer> {
    try {
      return await this.withRetry(async () => {
        const response = await this.client.get(endpoint, {
          responseType: "arraybuffer",
          headers: {
            Accept: "*/*",
          },
        });
        return Buffer.from(response.data);
      }, `GET (binary) ${endpoint}`);
    } catch (error) {
      const apiError = this.handleError(error as AxiosError);
      throw new Error(`${apiError.message}${apiError.details ? ` - ${apiError.details}` : ""}`);
    }
  }
}

let apiClientInstance: PolarApiClient | null = null;

export function getApiClient(): PolarApiClient {
  if (!apiClientInstance) {
    apiClientInstance = new PolarApiClient();
  }
  return apiClientInstance;
}
