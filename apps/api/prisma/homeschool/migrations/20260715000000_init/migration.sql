-- CreateTable
CREATE TABLE "hs_accounts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "parentFirstName" TEXT NOT NULL,
    "parentLastName" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hs_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hs_courses" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT NOT NULL,
    "gradeLevel" TEXT NOT NULL,
    "board" TEXT,
    "coverUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hs_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hs_modules" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hs_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hs_lessons" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "videoUrl" TEXT,
    "attachmentUrl" TEXT,
    "durationMin" INTEGER,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "isFreePreview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hs_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hs_learners" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" DATE,
    "gradeLevel" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hs_learners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hs_enrollments" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hs_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hs_lesson_progress" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hs_lesson_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hs_subscriptions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'FAMILY',
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hs_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hs_accounts_email_key" ON "hs_accounts"("email");

-- CreateIndex
CREATE INDEX "hs_courses_gradeLevel_idx" ON "hs_courses"("gradeLevel");

-- CreateIndex
CREATE INDEX "hs_courses_subject_idx" ON "hs_courses"("subject");

-- CreateIndex
CREATE INDEX "hs_modules_courseId_idx" ON "hs_modules"("courseId");

-- CreateIndex
CREATE INDEX "hs_lessons_moduleId_idx" ON "hs_lessons"("moduleId");

-- CreateIndex
CREATE INDEX "hs_learners_accountId_idx" ON "hs_learners"("accountId");

-- CreateIndex
CREATE INDEX "hs_enrollments_accountId_idx" ON "hs_enrollments"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "hs_enrollments_learnerId_courseId_key" ON "hs_enrollments"("learnerId", "courseId");

-- CreateIndex
CREATE INDEX "hs_lesson_progress_accountId_learnerId_idx" ON "hs_lesson_progress"("accountId", "learnerId");

-- CreateIndex
CREATE UNIQUE INDEX "hs_lesson_progress_learnerId_lessonId_key" ON "hs_lesson_progress"("learnerId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "hs_subscriptions_razorpayOrderId_key" ON "hs_subscriptions"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "hs_subscriptions_accountId_idx" ON "hs_subscriptions"("accountId");

-- AddForeignKey
ALTER TABLE "hs_modules" ADD CONSTRAINT "hs_modules_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "hs_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hs_lessons" ADD CONSTRAINT "hs_lessons_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "hs_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hs_learners" ADD CONSTRAINT "hs_learners_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "hs_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hs_enrollments" ADD CONSTRAINT "hs_enrollments_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "hs_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hs_enrollments" ADD CONSTRAINT "hs_enrollments_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "hs_learners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hs_enrollments" ADD CONSTRAINT "hs_enrollments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "hs_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hs_lesson_progress" ADD CONSTRAINT "hs_lesson_progress_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "hs_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hs_lesson_progress" ADD CONSTRAINT "hs_lesson_progress_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "hs_learners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hs_lesson_progress" ADD CONSTRAINT "hs_lesson_progress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "hs_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hs_subscriptions" ADD CONSTRAINT "hs_subscriptions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "hs_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

