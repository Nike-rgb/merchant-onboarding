import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MerchantApplication } from '../entities/merchant-application.entity';
import { ApplicationStatus } from '../enums/application-status.enum';
import { BusinessType } from '../enums/business-type.enum';
import { RiskStatus } from '../enums/risk-status.enum';
import { maskLast4 } from '../../audit/redaction.util';

/**
 * API representation of an application. Deliberately maps from the entity so
 * sensitive fields (ownerTaxId) are masked and internals are never leaked.
 */
export class ApplicationResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() businessName: string;
  @ApiProperty() legalBusinessName: string;
  @ApiProperty({ enum: BusinessType }) businessType: BusinessType;
  @ApiProperty() ownerName: string;
  @ApiProperty() ownerEmail: string;
  @ApiProperty() ownerPhone: string;
  @ApiPropertyOptional({ description: 'Masked to last 4 in responses' })
  ownerTaxId: string | null;
  @ApiProperty() monthlyProcessingVolume: number;
  @ApiProperty() averageTicketSize: number;
  @ApiProperty() currency: string;
  @ApiProperty({ enum: ApplicationStatus }) status: ApplicationStatus;
  @ApiProperty({ enum: RiskStatus }) riskStatus: RiskStatus;
  @ApiPropertyOptional() riskScore: number | null;
  @ApiPropertyOptional() riskReason: string | null;
  @ApiProperty() createdById: string;
  @ApiPropertyOptional() assignedReviewerId: string | null;
  @ApiPropertyOptional() decisionNotes: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiPropertyOptional() submittedAt: Date | null;
  @ApiPropertyOptional() decidedAt: Date | null;

  static fromEntity(app: MerchantApplication): ApplicationResponseDto {
    return {
      id: app.id,
      businessName: app.businessName,
      legalBusinessName: app.legalBusinessName,
      businessType: app.businessType,
      ownerName: app.ownerName,
      ownerEmail: app.ownerEmail,
      ownerPhone: app.ownerPhone,
      ownerTaxId: maskLast4(app.ownerTaxId),
      monthlyProcessingVolume: app.monthlyProcessingVolume,
      averageTicketSize: app.averageTicketSize,
      currency: app.currency,
      status: app.status,
      riskStatus: app.riskStatus,
      riskScore: app.riskScore,
      riskReason: app.riskReason,
      createdById: app.createdById,
      assignedReviewerId: app.assignedReviewerId,
      decisionNotes: app.decisionNotes,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      submittedAt: app.submittedAt,
      decidedAt: app.decidedAt,
    };
  }
}

export class PaginatedApplicationsDto {
  @ApiProperty({ type: [ApplicationResponseDto] })
  data: ApplicationResponseDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
}
