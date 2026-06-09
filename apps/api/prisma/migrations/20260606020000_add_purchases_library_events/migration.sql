-- CreateEnum
CREATE TYPE "PurchaseCategory" AS ENUM ('UNIFORM', 'BOOKS', 'MATERIALS', 'OTHER');

-- CreateEnum
CREATE TYPE "EventMediaType" AS ENUM ('PHOTO', 'YOUTUBE');

-- AlterTable
ALTER TABLE "school_profiles" ADD COLUMN     "libraryFinePerDay" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "store_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "PurchaseCategory" NOT NULL DEFAULT 'OTHER',
    "price" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "storeItemId" TEXT,
    "itemName" TEXT NOT NULL,
    "category" "PurchaseCategory" NOT NULL DEFAULT 'OTHER',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "amount" DOUBLE PRECISION NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_books" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "isbn" TEXT,
    "category" TEXT,
    "readingLevel" TEXT,
    "coverUrl" TEXT,
    "totalCopies" INTEGER NOT NULL DEFAULT 1,
    "availableCopies" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_issues" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "returnedAt" TIMESTAMP(3),
    "fineAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fineCollected" BOOLEAN NOT NULL DEFAULT false,
    "issuedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "book_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "location" TEXT,
    "classId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_media" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" "EventMediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "store_items_tenantId_idx" ON "store_items"("tenantId");

-- CreateIndex
CREATE INDEX "purchases_tenantId_idx" ON "purchases"("tenantId");

-- CreateIndex
CREATE INDEX "purchases_tenantId_studentId_idx" ON "purchases"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "library_books_tenantId_idx" ON "library_books"("tenantId");

-- CreateIndex
CREATE INDEX "book_issues_tenantId_idx" ON "book_issues"("tenantId");

-- CreateIndex
CREATE INDEX "book_issues_tenantId_studentId_idx" ON "book_issues"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "book_issues_bookId_idx" ON "book_issues"("bookId");

-- CreateIndex
CREATE INDEX "school_events_tenantId_idx" ON "school_events"("tenantId");

-- CreateIndex
CREATE INDEX "school_events_tenantId_eventDate_idx" ON "school_events"("tenantId", "eventDate");

-- CreateIndex
CREATE INDEX "event_media_eventId_idx" ON "event_media"("eventId");

-- AddForeignKey
ALTER TABLE "store_items" ADD CONSTRAINT "store_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_storeItemId_fkey" FOREIGN KEY ("storeItemId") REFERENCES "store_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_books" ADD CONSTRAINT "library_books_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_issues" ADD CONSTRAINT "book_issues_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_issues" ADD CONSTRAINT "book_issues_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "library_books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_issues" ADD CONSTRAINT "book_issues_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_issues" ADD CONSTRAINT "book_issues_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_events" ADD CONSTRAINT "school_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_events" ADD CONSTRAINT "school_events_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_events" ADD CONSTRAINT "school_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_media" ADD CONSTRAINT "event_media_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_media" ADD CONSTRAINT "event_media_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "school_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

