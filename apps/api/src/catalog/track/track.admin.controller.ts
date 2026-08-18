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
import { CreateTrackDto } from './dto/create-track.dto';
import { ListTrackQueryDto } from './dto/list-track-query.dto';
import { UpdateTrackDto } from './dto/update-track.dto';
import { type AdminTrackResponse, toAdminTrackResponse } from './track.response';
import { TrackService } from './track.service';

@Controller('admin/tracks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class TrackAdminController {
  constructor(private readonly trackService: TrackService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateTrackDto,
  ): Promise<AdminTrackResponse> {
    const track = await this.trackService.create(request.auth.sub, dto);
    return toAdminTrackResponse(track);
  }

  @Get()
  async list(@Query() query: ListTrackQueryDto): Promise<PaginatedResult<AdminTrackResponse>> {
    const result = await this.trackService.list(query);
    return { ...result, items: result.items.map(toAdminTrackResponse) };
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<AdminTrackResponse> {
    const track = await this.trackService.findById(id);
    return toAdminTrackResponse(track);
  }

  @Patch(':id')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateTrackDto,
  ): Promise<AdminTrackResponse> {
    const track = await this.trackService.update(request.auth.sub, id, dto);
    return toAdminTrackResponse(track);
  }

  @Post(':id/ready')
  @HttpCode(HttpStatus.OK)
  async ready(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<AdminTrackResponse> {
    const track = await this.trackService.transition(request.auth.sub, id, 'ready');
    return toAdminTrackResponse(track);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  async publish(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<AdminTrackResponse> {
    const track = await this.trackService.transition(request.auth.sub, id, 'publish');
    return toAdminTrackResponse(track);
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  async unpublish(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<AdminTrackResponse> {
    const track = await this.trackService.transition(request.auth.sub, id, 'unpublish');
    return toAdminTrackResponse(track);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  async archive(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<AdminTrackResponse> {
    const track = await this.trackService.transition(request.auth.sub, id, 'archive');
    return toAdminTrackResponse(track);
  }
}
