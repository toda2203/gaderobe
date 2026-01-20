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

-- Insert predefined sizes
INSERT INTO "master_data_items" ("id", "type", "value", "order", "createdAt", "updatedAt") VALUES
('size_xs', 'SIZE', 'XS', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('size_s', 'SIZE', 'S', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('size_m', 'SIZE', 'M', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('size_l', 'SIZE', 'L', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('size_xl', 'SIZE', 'XL', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('size_xxl', 'SIZE', 'XXL', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('size_32', 'SIZE', '32', 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('size_34', 'SIZE', '34', 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('size_36', 'SIZE', '36', 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('size_38', 'SIZE', '38', 9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('size_40', 'SIZE', '40', 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('size_42', 'SIZE', '42', 11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('size_44', 'SIZE', '44', 12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('size_46', 'SIZE', '46', 13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('size_48', 'SIZE', '48', 14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('size_50', 'SIZE', '50', 15, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('size_52', 'SIZE', '52', 16, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('size_54', 'SIZE', '54', 17, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('size_56', 'SIZE', '56', 18, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Insert predefined categories
INSERT INTO "master_data_items" ("id", "type", "value", "order", "createdAt", "updatedAt") VALUES
('cat_herren', 'CATEGORY', 'Herren', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cat_damen', 'CATEGORY', 'Damen', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cat_unisex', 'CATEGORY', 'Unisex', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
