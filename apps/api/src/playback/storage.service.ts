import { type Readable } from 'node:stream';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';

/**
 * `flacFileUrl` keeps its existing URL contract (Milestone 5 decision — no
 * rename, no reinterpretation, no data migration): this only extracts the
 * URL's path as the MinIO object key, it never changes what's stored on
 * `Track.flacFileUrl` or how it's validated there.
 */
export function resolveMinioObjectKey(flacFileUrl: string): string {
  const { pathname } = new URL(flacFileUrl);
  return pathname.replace(/^\/+/, '');
}

/**
 * The minimal storage abstraction Milestone 5 requires: resolves a track's
 * `flacFileUrl` to bytes from MinIO, the only storage provider implemented.
 * Callers (the streaming controller/service) never see MinIO's endpoint or
 * credentials or receive a direct storage URL — every byte is read through
 * this service and proxied by the API process.
 */
@Injectable()
export class StorageService {
  private readonly client: MinioClient;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.client = new MinioClient({
      endPoint: this.configService.getOrThrow<string>('MINIO_ENDPOINT'),
      port: this.configService.getOrThrow<number>('MINIO_PORT'),
      useSSL: this.configService.getOrThrow<boolean>('MINIO_USE_SSL'),
      accessKey: this.configService.getOrThrow<string>('MINIO_ACCESS_KEY'),
      secretKey: this.configService.getOrThrow<string>('MINIO_SECRET_KEY'),
    });
    this.bucket = this.configService.getOrThrow<string>('MINIO_BUCKET');
  }

  async getObjectSize(flacFileUrl: string): Promise<number> {
    const stat = await this.client.statObject(this.bucket, resolveMinioObjectKey(flacFileUrl));
    return stat.size;
  }

  /**
   * Reads bytes `[startByteInclusive, endByteInclusive]` (both inclusive,
   * matching HTTP Range semantics), or from `startByteInclusive` to EOF
   * when `endByteInclusive` is omitted.
   */
  async readRange(
    flacFileUrl: string,
    startByteInclusive: number,
    endByteInclusive?: number,
  ): Promise<Readable> {
    const length =
      endByteInclusive === undefined ? undefined : endByteInclusive - startByteInclusive + 1;
    return this.client.getPartialObject(
      this.bucket,
      resolveMinioObjectKey(flacFileUrl),
      startByteInclusive,
      length,
    );
  }
}
