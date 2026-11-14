-- Items tracked by count instead of serial numbers, and technicians recording what they used
ALTER TYPE "UnitStatus" ADD VALUE 'RETIRED';
ALTER TYPE "StockRequestType" ADD VALUE 'USE';
