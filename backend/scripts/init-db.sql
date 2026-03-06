-- ============================================================================
-- FNB-Ops Database Initialization Script
-- ============================================================================
-- This script runs automatically when the MySQL container starts for the first time

-- Set strict SQL mode
SET SESSION sql_mode = 'STRICT_TRANS_TABLES';

-- Create database with proper charset (if not already created by MYSQL_DATABASE env var)
-- CREATE DATABASE IF NOT EXISTS fnb_ops_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Use the database
-- USE fnb_ops_db;

-- Create indexes for common queries (these will be created by Django migrations)
-- but we can add optimization hints here if needed

-- Set timezone
SET GLOBAL time_zone = 'UTC';
SET SESSION time_zone = 'UTC';

-- Optimize for fnb-ops workload
SET GLOBAL max_connections = 1000;
SET GLOBAL max_allowed_packet = 256 * 1024 * 1024;  -- 256MB for large uploads
SET GLOBAL wait_timeout = 28800;  -- 8 hours
SET GLOBAL interactive_timeout = 28800;

-- Character set for database
ALTER DATABASE fnb_ops_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Session variables
SET SESSION character_set_client = utf8mb4;
SET SESSION character_set_connection = utf8mb4;
SET SESSION character_set_results = utf8mb4;
SET SESSION character_set_server = utf8mb4;

-- Log configuration (optional, for debugging)
-- SET GLOBAL log_error_verbosity = 3;
-- SET GLOBAL slow_query_log = 'ON';
-- SET GLOBAL long_query_time = 2;

-- All done - Django migrations will handle table creation
