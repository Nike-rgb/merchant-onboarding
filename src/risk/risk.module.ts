import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchantApplication } from '../applications/entities/merchant-application.entity';
import { AuditModule } from '../audit/audit.module';
import { RiskAssessmentService } from './risk-assessment.service';
import { RiskProcessor } from './risk.processor';
import { RiskProducer } from './risk.producer';
import { RISK_QUEUE } from './risk.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: RISK_QUEUE }),
    TypeOrmModule.forFeature([MerchantApplication]),
    AuditModule,
  ],
  providers: [RiskProducer, RiskProcessor, RiskAssessmentService],
  exports: [RiskProducer],
})
export class RiskModule {}
