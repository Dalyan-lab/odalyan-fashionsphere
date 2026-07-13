-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "logoPosition" TEXT NOT NULL DEFAULT 'top-left',
ADD COLUMN     "bannerPosition" TEXT NOT NULL DEFAULT 'center';
