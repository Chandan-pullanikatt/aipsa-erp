-- CreateEnum
CREATE TYPE "HostelType" AS ENUM ('BOYS', 'GIRLS', 'MIXED');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER');

-- CreateEnum
CREATE TYPE "GatePassStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- AlterTable: transport assignment on students
ALTER TABLE "students" ADD COLUMN "busRouteId" TEXT;
ALTER TABLE "students" ADD COLUMN "boardingPoint" TEXT;

-- CreateTable
CREATE TABLE "bus_routes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "routeNumber" TEXT,
    "busNumber" TEXT,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "capacity" INTEGER,
    "notes" TEXT,
    "trackToken" TEXT,
    "lastLat" DOUBLE PRECISION,
    "lastLng" DOUBLE PRECISION,
    "lastLocationAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bus_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_stops" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "pickupTime" TEXT,
    "dropTime" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hostels" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "HostelType",
    "wardenName" TEXT,
    "wardenPhone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hostels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hostel_rooms" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "floor" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hostel_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hostel_allotments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "bedLabel" TEXT,
    "allottedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hostel_allotments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mess_menus" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "hostelId" TEXT,
    "dayOfWeek" INTEGER NOT NULL,
    "meal" "MealType" NOT NULL,
    "items" TEXT NOT NULL,
    "time" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mess_menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gate_passes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "destination" TEXT,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "status" "GatePassStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gate_passes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hostel_complaints" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "category" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hostel_complaints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bus_routes_trackToken_key" ON "bus_routes"("trackToken");
CREATE INDEX "bus_routes_tenantId_idx" ON "bus_routes"("tenantId");
CREATE INDEX "route_stops_tenantId_idx" ON "route_stops"("tenantId");
CREATE INDEX "route_stops_routeId_idx" ON "route_stops"("routeId");
CREATE INDEX "hostels_tenantId_idx" ON "hostels"("tenantId");
CREATE INDEX "hostel_rooms_tenantId_idx" ON "hostel_rooms"("tenantId");
CREATE INDEX "hostel_rooms_hostelId_idx" ON "hostel_rooms"("hostelId");
CREATE UNIQUE INDEX "hostel_allotments_studentId_key" ON "hostel_allotments"("studentId");
CREATE INDEX "hostel_allotments_tenantId_idx" ON "hostel_allotments"("tenantId");
CREATE INDEX "hostel_allotments_roomId_idx" ON "hostel_allotments"("roomId");
CREATE INDEX "mess_menus_tenantId_idx" ON "mess_menus"("tenantId");
CREATE INDEX "gate_passes_tenantId_idx" ON "gate_passes"("tenantId");
CREATE INDEX "gate_passes_studentId_idx" ON "gate_passes"("studentId");
CREATE INDEX "hostel_complaints_tenantId_idx" ON "hostel_complaints"("tenantId");
CREATE INDEX "hostel_complaints_studentId_idx" ON "hostel_complaints"("studentId");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_busRouteId_fkey" FOREIGN KEY ("busRouteId") REFERENCES "bus_routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bus_routes" ADD CONSTRAINT "bus_routes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "bus_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hostels" ADD CONSTRAINT "hostels_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hostel_rooms" ADD CONSTRAINT "hostel_rooms_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hostel_rooms" ADD CONSTRAINT "hostel_rooms_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hostel_allotments" ADD CONSTRAINT "hostel_allotments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hostel_allotments" ADD CONSTRAINT "hostel_allotments_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hostel_allotments" ADD CONSTRAINT "hostel_allotments_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "hostel_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hostel_allotments" ADD CONSTRAINT "hostel_allotments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mess_menus" ADD CONSTRAINT "mess_menus_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mess_menus" ADD CONSTRAINT "mess_menus_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gate_passes" ADD CONSTRAINT "gate_passes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gate_passes" ADD CONSTRAINT "gate_passes_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gate_passes" ADD CONSTRAINT "gate_passes_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hostel_complaints" ADD CONSTRAINT "hostel_complaints_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hostel_complaints" ADD CONSTRAINT "hostel_complaints_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
