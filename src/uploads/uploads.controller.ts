import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UnsupportedMediaTypeException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import { Request } from 'express';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UploadsService } from './uploads.service';

const TOUR_UPLOAD_DIR = join(process.cwd(), 'uploads', 'tours');
mkdirSync(TOUR_UPLOAD_DIR, { recursive: true });

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

@ApiTags('uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('tours')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: TOUR_UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname) || '.jpg';
          cb(null, `${Date.now()}-${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (!IMAGE_MIME_TYPES.includes(file.mimetype)) {
          return cb(
            new UnsupportedMediaTypeException('Only image files are allowed'),
            false,
          );
        }

        return cb(null, true);
      },
    }),
  )
  uploadTourImage(@Req() req: Request & { file?: Express.Multer.File }) {
    if (!req.file) {
      throw new BadRequestException('File is required');
    }

    const url = this.uploadsService.buildTourUrl(req, req.file.filename);

    return { url };
  }
}
