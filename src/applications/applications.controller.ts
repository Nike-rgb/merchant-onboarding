import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/types/auth-user.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { AuditService } from '../audit/audit.service';
import { ApplicationsService } from './applications.service';
import {
  ApplicationResponseDto,
  PaginatedApplicationsDto,
} from './dto/application-response.dto';
import { AssignReviewerDto } from './dto/assign-reviewer.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ListApplicationsQueryDto } from './dto/list-applications-query.dto';
import { ReviewDecisionDto } from './dto/review-decision.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';

@ApiTags('applications')
@ApiBearerAuth()
@Controller('applications')
export class ApplicationsController {
  constructor(
    private readonly applications: ApplicationsService,
    private readonly audit: AuditService,
  ) {}

  @Post()
  @Roles(UserRole.SALES, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a merchant application (SALES/ADMIN)' })
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    return ApplicationResponseDto.fromEntity(
      await this.applications.create(user, dto),
    );
  }

  @Get()
  @ApiOperation({
    summary: 'List applications (SALES sees only their own)',
  })
  async list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListApplicationsQueryDto,
  ): Promise<PaginatedApplicationsDto> {
    const result = await this.applications.list(user, query);
    return {
      ...result,
      data: result.data.map((a) => ApplicationResponseDto.fromEntity(a)),
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one application by id (object-level enforced)',
  })
  @ApiForbiddenResponse({
    description: "SALES user accessing another user's application",
  })
  async findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApplicationResponseDto> {
    return ApplicationResponseDto.fromEntity(
      await this.applications.findOne(user, id),
    );
  }

  @Patch(':id')
  @Roles(UserRole.SALES, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update an application while editable' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    return ApplicationResponseDto.fromEntity(
      await this.applications.update(user, id, dto),
    );
  }

  @Post(':id/submit')
  @Roles(UserRole.SALES, UserRole.ADMIN)
  @ApiOperation({ summary: 'Submit an application for risk review' })
  async submit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApplicationResponseDto> {
    return ApplicationResponseDto.fromEntity(
      await this.applications.submit(user, id),
    );
  }

  @Post(':id/assign')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Assign a reviewer (ADMIN)' })
  async assign(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignReviewerDto,
  ): Promise<ApplicationResponseDto> {
    return ApplicationResponseDto.fromEntity(
      await this.applications.assignReviewer(user, id, dto.reviewerId),
    );
  }

  @Post(':id/decision')
  @Roles(UserRole.REVIEWER)
  @ApiOperation({
    summary: 'Record a risk decision (only the assigned REVIEWER)',
  })
  async decide(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDecisionDto,
  ): Promise<ApplicationResponseDto> {
    return ApplicationResponseDto.fromEntity(
      await this.applications.recordDecision(user, id, dto),
    );
  }

  @Get(':id/audit')
  @Roles(UserRole.ADMIN, UserRole.REVIEWER)
  @ApiOperation({ summary: 'Read the audit trail for an application' })
  async auditTrail(@Param('id', ParseUUIDPipe) id: string) {
    return this.audit.findForApplication(id);
  }
}
