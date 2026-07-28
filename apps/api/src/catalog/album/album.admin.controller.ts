import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { Roles } from '../../auth/decorators/roles.decorator';
import { type AuthenticatedRequest, JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { type PaginatedResult } from '../pagination';
import { AlbumService } from './album.service';
import { type AdminAlbumResponse, toAdminAlbumResponse } from './album.response';
import { CreateAlbumDto } from './dto/create-album.dto';
import { ListAlbumQueryDto } from './dto/list-album-query.dto';
import { UpdateAlbumDto } from './dto/update-album.dto';

@Controller('admin/albums')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AlbumAdminController {
  constructor(private readonly albumService: AlbumService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateAlbumDto,
  ): Promise<AdminAlbumResponse> {
    const album = await this.albumService.create(request.auth.sub, dto);
    return toAdminAlbumResponse(album);
  }

  @Get()
  async list(@Query() query: ListAlbumQueryDto): Promise<PaginatedResult<AdminAlbumResponse>> {
    const result = await this.albumService.list(query);
    return { ...result, items: result.items.map(toAdminAlbumResponse) };
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<AdminAlbumResponse> {
    const album = await this.albumService.findById(id);
    return toAdminAlbumResponse(album);
  }

  @Patch(':id')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateAlbumDto,
  ): Promise<AdminAlbumResponse> {
    const album = await this.albumService.update(request.auth.sub, id, dto);
    return toAdminAlbumResponse(album);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  async publish(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<AdminAlbumResponse> {
    const album = await this.albumService.setPublished(request.auth.sub, id, true);
    return toAdminAlbumResponse(album);
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  async unpublish(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<AdminAlbumResponse> {
    const album = await this.albumService.setPublished(request.auth.sub, id, false);
    return toAdminAlbumResponse(album);
  }
}
