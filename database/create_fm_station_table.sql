-- Create fm_station table
CREATE TABLE IF NOT EXISTS fm_station (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    frequency DECIMAL(5,2) NOT NULL,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL,
    genre VARCHAR(100) NOT NULL,
    description TEXT,
    website VARCHAR(255),
    transmitter_power INTEGER NOT NULL, -- in watts
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE fm_station ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access
CREATE POLICY "Enable read access for all users" ON fm_station
    FOR SELECT USING (true);

-- Optional: Create policy to allow authenticated users to insert
-- CREATE POLICY "Enable insert for authenticated users only" ON fm_station
--     FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_fm_station_frequency ON fm_station(frequency);
CREATE INDEX IF NOT EXISTS idx_fm_station_city ON fm_station(city);
CREATE INDEX IF NOT EXISTS idx_fm_station_genre ON fm_station(genre);
CREATE INDEX IF NOT EXISTS idx_fm_station_location ON fm_station(latitude, longitude);

-- Insert sample FM station data (Los Angeles area)
INSERT INTO fm_station (name, frequency, latitude, longitude, city, state, genre, description, website, transmitter_power) VALUES
('KROQ', 106.7, 34.0522, -118.2437, 'Los Angeles', 'CA', 'Alternative Rock', 'World famous KROQ - Alternative Rock', 'https://kroq.radio.com', 58000),
('KLOS', 95.5, 34.1022, -118.3437, 'Los Angeles', 'CA', 'Classic Rock', 'Classic Rock of Southern California', 'https://klos.com', 50000),
('KPWR Power 106', 105.9, 34.0722, -118.2937, 'Los Angeles', 'CA', 'Hip Hop', 'Power 106 - Hip Hop and R&B', 'https://power106.com', 44000),
('KCRW', 89.9, 34.0422, -118.4937, 'Santa Monica', 'CA', 'Public Radio', 'Public Radio from Santa Monica College', 'https://kcrw.com', 59000),
('KBIG My FM', 104.3, 34.1422, -118.1437, 'Los Angeles', 'CA', 'Adult Contemporary', 'My FM - Adult Contemporary Hits', 'https://mybig.com', 25000),
('KFWB Jack FM', 93.1, 33.9522, -118.2237, 'Los Angeles', 'CA', 'Variety', 'Jack FM - Playing What We Want', 'https://jackfm.com', 40000),
('KDAY', 93.5, 34.0322, -118.2737, 'Los Angeles', 'CA', 'Old School Hip Hop', 'Old School 93.5 KDAY', 'https://kday.com', 30000),
('KIIS FM', 102.7, 34.0622, -118.2137, 'Los Angeles', 'CA', 'Top 40', 'Kiss FM - Today''s Hit Music', 'https://1027kiisfm.com', 50000),
('KNX 1070', 107.0, 34.0522, -118.2437, 'Los Angeles', 'CA', 'News/Talk', 'KNX 1070 News Radio', 'https://knx1070.radio.com', 75000),
('KOST 103.5', 103.5, 34.0822, -118.2237, 'Los Angeles', 'CA', 'Soft Rock', 'KOST 103.5 - Feel Good Music', 'https://kost1035.com', 35000),
('The Sound', 100.3, 34.0622, -118.3437, 'Los Angeles', 'CA', 'Classic Rock', 'The Sound - Classic Rock Deep Cuts', 'https://thesoundla.com', 42000),
('Alt 98.7', 98.7, 34.0922, -118.2837, 'Los Angeles', 'CA', 'Alternative', 'Alt 98.7 - New Alternative', 'https://alt987fm.com', 38000),
('Real 92.3', 92.3, 34.0422, -118.2637, 'Los Angeles', 'CA', 'Hip Hop', 'Real 92.3 - Hip Hop and R&B', 'https://real923la.com', 45000),
('KPCC 89.3', 89.3, 34.1422, -118.1237, 'Pasadena', 'CA', 'Public Radio', 'KPCC - Southern California Public Radio', 'https://kpcc.org', 110000),
('KLSX 97.1', 97.1, 34.0722, -118.3137, 'Los Angeles', 'CA', 'Talk Radio', 'The Talk of Los Angeles', 'https://am570.com', 48000);

-- Update the updated_at column trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_fm_station_updated_at 
    BEFORE UPDATE ON fm_station 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();