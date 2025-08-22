-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."competition" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "kana" VARCHAR(60),
    "show_name" VARCHAR(30),
    "place" VARCHAR(30),
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idx_16403_primary" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."course" (
    "id" INTEGER NOT NULL,
    "type" VARCHAR(30) NOT NULL DEFAULT 'road',
    "competition_id" INTEGER NOT NULL,
    "show_name" VARCHAR(30),
    "time" INTEGER,
    "distance" DOUBLE PRECISION,
    "elevation" INTEGER,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idx_16410_primary" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ekiden_competition" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(100),
    "kana" VARCHAR(100),
    "show_name" VARCHAR(30),
    "place" VARCHAR(30),
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idx_16418_primary" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ekiden_race" (
    "id" INTEGER NOT NULL,
    "ekiden_competition_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idx_16425_primary" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ekiden_result" (
    "ekiden_team_id" INTEGER NOT NULL,
    "kukan" INTEGER NOT NULL,
    "member_id" INTEGER NOT NULL,
    "time_individual" INTEGER,
    "time_gross" INTEGER,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ekiden_result_pkey" PRIMARY KEY ("ekiden_team_id","member_id")
);

-- CreateTable
CREATE TABLE "public"."ekiden_team" (
    "id" INTEGER NOT NULL,
    "ekiden_race_id" INTEGER NOT NULL,
    "team_name" VARCHAR(30),
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idx_16439_primary" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."member" (
    "id" INTEGER NOT NULL,
    "family_name" VARCHAR(30) NOT NULL,
    "family_kana" VARCHAR(30),
    "first_name" VARCHAR(30) NOT NULL,
    "first_kana" VARCHAR(30),
    "show_name" VARCHAR(30) NOT NULL,
    "kana" VARCHAR(60),
    "year" INTEGER NOT NULL,
    "sex" VARCHAR(30),
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idx_16446_primary" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."race" (
    "id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idx_16452_primary" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."race_participant" (
    "result_id" INTEGER NOT NULL,
    "member_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "race_participant_pkey" PRIMARY KEY ("result_id","member_id")
);

-- CreateTable
CREATE TABLE "public"."result" (
    "id" INTEGER NOT NULL,
    "race_id" INTEGER NOT NULL,
    "time" INTEGER,
    "distance" DOUBLE PRECISION,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idx_16472_primary" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_16410_course2copmetition" ON "public"."course"("competition_id");

-- CreateIndex
CREATE INDEX "idx_16425_date" ON "public"."ekiden_race"("date");

-- CreateIndex
CREATE INDEX "idx_16446_year" ON "public"."member"("year", "family_kana", "first_kana");

-- CreateIndex
CREATE INDEX "idx_16452_race2course" ON "public"."race"("course_id");

-- CreateIndex
CREATE INDEX "idx_16459_race_participant2member" ON "public"."race_participant"("member_id");

-- CreateIndex
CREATE INDEX "idx_16459_race_participant2result" ON "public"."race_participant"("result_id");

-- CreateIndex
CREATE INDEX "idx_16472_distance" ON "public"."result"("distance");

-- CreateIndex
CREATE INDEX "idx_16472_result2race" ON "public"."result"("race_id");

-- CreateIndex
CREATE INDEX "idx_16472_time" ON "public"."result"("time");

-- AddForeignKey
ALTER TABLE "public"."course" ADD CONSTRAINT "course2copmetition" FOREIGN KEY ("competition_id") REFERENCES "public"."competition"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."race" ADD CONSTRAINT "race2course" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."race_participant" ADD CONSTRAINT "race_participant2result" FOREIGN KEY ("result_id") REFERENCES "public"."result"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."result" ADD CONSTRAINT "result2race" FOREIGN KEY ("race_id") REFERENCES "public"."race"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

