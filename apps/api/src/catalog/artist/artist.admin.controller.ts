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
import { ArtistService } from './artist.service';
import { CreateArtistDto } from './dto/create-artist.dto';
import { ListArtistQueryDto } from './dto/list-artist-query.dto';
import { UpdateArtistDto } from './dto/update-artist.dto';
import { type AdminArtistResponse, toAdminArtistResponse } from './artist.response';

@Controller('admin/artists')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ArtistAdminController {
  constructor(private readonly artistService: ArtistService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateArtistDto,
  ): Promise<AdminArtistResponse> {
    const artist = await this.artistService.create(request.auth.sub, dto);
    return toAdminArtistResponse(artist);
  }

  @Get()
  async list(@Query() query: ListArtistQueryDto): Promise<PaginatedResult<AdminArtistResponse>> {
    const result = await this.artistService.list(query);
    return { ...result, items: result.items.map(toAdminArtistResponse) };
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<AdminArtistResponse> {
    const artist = await this.artistService.findById(id);
    return toAdminArtistResponse(artist);
  }

  @Patch(':id')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateArtistDto,
  ): Promise<AdminArtistResponse> {
    const artist = await this.artistService.update(request.auth.sub, id, dto);
    return toAdminArtistResponse(artist);
  }

  @Post(':id/enable')
  @HttpCode(HttpStatus.OK)
  async enable(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<AdminArtistResponse> {
    const artist = await this.artistService.setActive(request.auth.sub, id, true);
    return toAdminArtistResponse(artist);
  }

  @Post(':id/disable')
  @HttpCode(HttpStatus.OK)
  async disable(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<AdminArtistResponse> {
    const artist = await this.artistService.setActive(request.auth.sub, id, false);
    return toAdminArtistResponse(artist);
  }
}
