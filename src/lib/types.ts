export type JobStatus =
  | 'queued'
  | 'probing'
  | 'processing'
  | 'verifying'
  | 'completed'
  | 'failed';

export type Codec = 'h264' | 'h265' | 'av1';

export type Resolution = '480p' | '720p' | '1080p' | '2160p';

export interface ProbeData {
  duration_sec: number;
  width: number;
  height: number;
  resolution: Resolution;
  fps: number;
  video_codec: string;
  video_bitrate_kbps: number;
  audio_codec: string | null;
  audio_bitrate_kbps: number | null;
}

export interface LoginRequest {
  password: string;
  totp: string;
}

export interface LoginResponse {
  token: string;
  expires_at: number;
}

export interface UploadInitResponse {
  upload_url: string;
  file_id: string;
  expires_at: number;
}

export interface CompressRequest {
  file_id: string;
  target_size_mb: number;
  codec: Codec;
  max_resolution?: Resolution;
  audio_bitrate_kbps: 64 | 96 | 128 | 192 | 256 | 320;
}

export interface CompressResponse {
  job_id: string;
  status: JobStatus;
}

export interface Job {
  job_id: string;
  status: JobStatus;
  progress_pct: number;
  estimated_time_remaining_sec: number | null;
  output_url: string | null;
  source_file_key: string;
  output_file_key: string | null;
  target_size_mb: number;
  actual_output_size_mb: number | null;
  codec: Codec;
  error_message: string | null;
  created_at: number;
  completed_at: number | null;
}

export interface ApiError {
  code: string;
  message: string;
}
