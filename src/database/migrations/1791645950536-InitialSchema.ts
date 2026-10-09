import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1791645950536 implements MigrationInterface {
  name = 'InitialSchema1791645950536';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('ADMIN', 'REVIEWER', 'SALES')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password_hash" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."merchant_applications_business_type_enum" AS ENUM('SOLE_PROPRIETORSHIP', 'PARTNERSHIP', 'LLC', 'CORPORATION', 'NON_PROFIT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."merchant_applications_status_enum" AS ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED', 'APPROVED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."merchant_applications_risk_status_enum" AS ENUM('PENDING', 'LOW', 'MEDIUM', 'HIGH', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "merchant_applications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_name" character varying NOT NULL, "legal_business_name" character varying NOT NULL, "business_type" "public"."merchant_applications_business_type_enum" NOT NULL, "owner_name" character varying NOT NULL, "owner_email" character varying NOT NULL, "owner_phone" character varying NOT NULL, "owner_tax_id" character varying, "monthly_processing_volume" numeric(14,2) NOT NULL, "average_ticket_size" numeric(14,2) NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'USD', "status" "public"."merchant_applications_status_enum" NOT NULL DEFAULT 'DRAFT', "risk_status" "public"."merchant_applications_risk_status_enum" NOT NULL DEFAULT 'PENDING', "risk_score" integer, "risk_reason" text, "created_by_id" uuid NOT NULL, "assigned_reviewer_id" uuid, "decision_notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "submitted_at" TIMESTAMP WITH TIME ZONE, "decided_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_09b9df0877db73b8a232c8c7ed4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f9b444dd14c28c317a317eddac" ON "merchant_applications"  ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_13e93b2642db8ded99e0b2d824" ON "merchant_applications"  ("risk_status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2da4df0ec53929a13cb78d8496" ON "merchant_applications"  ("created_by_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7da78a3bb9e76995dba067b83e" ON "merchant_applications"  ("assigned_reviewer_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."audit_logs_action_enum" AS ENUM('APPLICATION_CREATED', 'APPLICATION_UPDATED', 'APPLICATION_SUBMITTED', 'REVIEWER_ASSIGNED', 'RISK_ASSESSED', 'DECISION_RECORDED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "action" "public"."audit_logs_action_enum" NOT NULL, "actor_id" uuid, "application_id" uuid, "metadata" jsonb NOT NULL DEFAULT '{}', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cee5459245f652b75eb2759b4c" ON "audit_logs"  ("action") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_177183f29f438c488b5e8510cd" ON "audit_logs"  ("actor_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e64c07c384f813ed88b3031627" ON "audit_logs"  ("application_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "merchant_applications" ADD CONSTRAINT "FK_2da4df0ec53929a13cb78d8496a" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "merchant_applications" ADD CONSTRAINT "FK_7da78a3bb9e76995dba067b83ed" FOREIGN KEY ("assigned_reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "merchant_applications" DROP CONSTRAINT "FK_7da78a3bb9e76995dba067b83ed"`,
    );
    await queryRunner.query(
      `ALTER TABLE "merchant_applications" DROP CONSTRAINT "FK_2da4df0ec53929a13cb78d8496a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e64c07c384f813ed88b3031627"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_177183f29f438c488b5e8510cd"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cee5459245f652b75eb2759b4c"`,
    );
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TYPE "public"."audit_logs_action_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7da78a3bb9e76995dba067b83e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2da4df0ec53929a13cb78d8496"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_13e93b2642db8ded99e0b2d824"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f9b444dd14c28c317a317eddac"`,
    );
    await queryRunner.query(`DROP TABLE "merchant_applications"`);
    await queryRunner.query(
      `DROP TYPE "public"."merchant_applications_risk_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."merchant_applications_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."merchant_applications_business_type_enum"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
  }
}
