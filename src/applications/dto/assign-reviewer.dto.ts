import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignReviewerDto {
  @ApiProperty({
    description: 'User id of a REVIEWER to assign',
    format: 'uuid',
  })
  @IsUUID()
  reviewerId: string;
}
