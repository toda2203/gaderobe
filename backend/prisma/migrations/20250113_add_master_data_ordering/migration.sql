-- Create MasterDataItem table for ordering sizes, categories, departments
CREATE TABLE "master_data_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    UNIQUE("type", "value")
);

-- Create index for efficient queries
CREATE INDEX "master_data_items_type_order_idx" ON "master_data_items"("type", "order");
