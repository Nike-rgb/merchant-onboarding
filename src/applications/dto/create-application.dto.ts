import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { BusinessType } from '../enums/business-type.enum';

export class CreateApplicationDto {
  @ApiProperty({ example: "Joe's Coffee" })
  @IsString()
  @IsNotEmpty()
  businessName: string;

  @ApiProperty({ example: "Joe's Coffee LLC" })
  @IsString()
  @IsNotEmpty()
  legalBusinessName: string;

  @ApiProperty({ enum: BusinessType, example: BusinessType.LLC })
  @IsEnum(BusinessType)
  businessType: BusinessType;

  @ApiProperty({ example: 'Joe Smith' })
  @IsString()
  @IsNotEmpty()
  ownerName: string;

  @ApiProperty({ example: 'joe@example.com' })
  @IsEmail()
  ownerEmail: string;

  @ApiProperty({ example: '+1-202-555-0100' })
  @IsString()
  @IsNotEmpty()
  ownerPhone: string;

  @ApiPropertyOptional({
    example: '12-3456789',
    description:
      'Sensitive (EIN/SSN). Masked in logs; candidate for field-level encryption.',
  })
  @IsOptional()
  @IsString()
  ownerTaxId?: string;

  @ApiProperty({ example: 50000 })
  @IsNumber()
  @IsPositive()
  monthlyProcessingVolume: number;

  @ApiProperty({ example: 75 })
  @IsNumber()
  @IsPositive()
  averageTicketSize: number;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter ISO code' })
  currency?: string;
}
