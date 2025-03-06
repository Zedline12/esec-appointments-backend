export interface ApiBasicResponse {
  statusCode: number;
  message: string | [string];
  error: string | null;
  timestamp: Number;
  version: string;
  path: string;
  data: any;
}
