-- Seed data for initial setup

-- Insert clothing types
INSERT INTO clothing_types (id, name, description, category, availableSizes, expectedLifespanMonths, isActive) VALUES
('clt1', 'Arbeitshose', 'Strapazierfähige Arbeitshose für Werkstatt', 'Hosen', '["42","44","46","48","50","52"]', 24, 1),
('clt2', 'Poloshirt', 'Poloshirt mit Firmenlogo', 'Shirts', '["S","M","L","XL","XXL"]', 18, 1),
('clt3', 'Winterjacke', 'Gefütterte Winterjacke', 'Jacken', '["S","M","L","XL","XXL"]', 36, 1),
('clt4', 'Sicherheitsschuhe S3', 'Sicherheitsschuhe Klasse S3', 'Schuhe', '["39","40","41","42","43","44","45"]', 12, 1),
('clt5', 'Softshell-Jacke', 'Leichte Softshell-Jacke', 'Jacken', '["S","M","L","XL","XXL"]', 24, 1);

-- Insert sample departments allocations
INSERT INTO department_allocations (id, department, clothingTypeId, quantity, mandatory, renewalIntervalMonths) VALUES
('da1', 'Werkstatt', 'clt1', 2, 1, 24),
('da2', 'Werkstatt', 'clt2', 3, 1, 18),
('da3', 'Werkstatt', 'clt4', 1, 1, 12),
('da4', 'Service', 'clt2', 2, 1, 18),
('da5', 'Service', 'clt5', 1, 0, 24),
('da6', 'Verkauf', 'clt2', 2, 1, 18);
