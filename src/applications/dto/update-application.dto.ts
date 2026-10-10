import { PartialType } from '@nestjs/swagger';
import { CreateApplicationDto } from './create-application.dto';

/** All fields optional; only provided fields are updated (while editable). */
export class UpdateApplicationDto extends PartialType(CreateApplicationDto) {}
