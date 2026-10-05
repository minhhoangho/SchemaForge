import type { SchemaDocument } from "../../../model/schema-document.js";
import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeIndex,
  makeRelation,
  makeTable,
} from "../../../testing/factories.js";
import type { ImportDiagnostic } from "../../shared/import-types.js";

// Written in the shape `mysqldump --no-data` of MySQL 8.4 gives: versioned
// /*!…*/ settings, DROP TABLE IF EXISTS before each table, keys and foreign
// keys inside CREATE TABLE, table options after it, and tables in name order.
// The LOCK TABLES pair is what a dump with data writes around each table.

export const MYSQLDUMP_SOURCE = `-- MySQL dump 10.13  Distrib 8.4.3, for Linux (x86_64)
--
-- Host: localhost    Database: shop
-- ------------------------------------------------------
-- Server version\t8.4.3

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table \`customers\`
--

DROP TABLE IF EXISTS \`customers\`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE \`customers\` (
  \`id\` int unsigned NOT NULL AUTO_INCREMENT,
  \`email\` varchar(255) COLLATE utf8mb4_bin NOT NULL,
  \`is_active\` tinyint(1) NOT NULL DEFAULT '1',
  \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  \`updated_at\` datetime(6) DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP(6),
  \`note\` text COMMENT 'Free text, it''s optional',
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`customers_email_key\` (\`email\`)
) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Store customers';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table \`customers\`
--

LOCK TABLES \`customers\` WRITE;
/*!40000 ALTER TABLE \`customers\` DISABLE KEYS */;
/*!40000 ALTER TABLE \`customers\` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table \`order_items\`
--

DROP TABLE IF EXISTS \`order_items\`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE \`order_items\` (
  \`order_id\` bigint NOT NULL,
  \`line_no\` smallint unsigned NOT NULL,
  \`quantity\` int NOT NULL DEFAULT '1',
  PRIMARY KEY (\`order_id\`,\`line_no\`),
  CONSTRAINT \`order_items_order_id_fkey\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table \`orders\`
--

DROP TABLE IF EXISTS \`orders\`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE \`orders\` (
  \`id\` bigint NOT NULL AUTO_INCREMENT,
  \`number\` varchar(20) NOT NULL,
  \`customer_id\` int unsigned NOT NULL,
  \`status\` enum('pending','paid','shipped') NOT NULL DEFAULT 'pending',
  \`total\` decimal(12,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uq_orders_number\` (\`number\`),
  KEY \`orders_customer_id_idx\` (\`customer_id\`),
  CONSTRAINT \`orders_customer_id_fkey\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`id\`)
) ENGINE=InnoDB AUTO_INCREMENT=1001 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-05  9:00:00
`;

const IMPORTED_NAME = "Imported";

// MySQL has no unsigned integers in the model: `int unsigned` widens to
// bigint and `smallint unsigned` to integer.
export const MYSQLDUMP_EXPECTED: SchemaDocument = buildSchema({
  name: IMPORTED_NAME,
  enums: [
    makeEnum({
      id: "enum_status",
      name: "orders_status",
      values: ["pending", "paid", "shipped"],
    }),
  ],
  tables: [
    makeTable({
      id: "tbl_customers",
      comment: "Store customers",
      primaryKeyColumnIds: ["col_customers_id"],
    }),
    makeTable({
      id: "tbl_items",
      name: "order_items",
      primaryKeyColumnIds: ["col_items_order", "col_items_line"],
    }),
    makeTable({ id: "tbl_orders", primaryKeyColumnIds: ["col_orders_id"] }),
  ],
  columns: [
    makeColumn({
      id: "col_customers_id",
      tableId: "tbl_customers",
      name: "id",
      type: { kind: "bigint" },
      isAutoIncrement: true,
    }),
    makeColumn({
      id: "col_customers_email",
      tableId: "tbl_customers",
      name: "email",
      type: { kind: "varchar", length: 255 },
      isUnique: true,
    }),
    makeColumn({
      id: "col_customers_active",
      tableId: "tbl_customers",
      name: "is_active",
      type: { kind: "boolean" },
      defaultValue: { kind: "literal", value: "true" },
    }),
    makeColumn({
      id: "col_customers_created",
      tableId: "tbl_customers",
      name: "created_at",
      type: { kind: "timestamptz" },
      defaultValue: { kind: "currentTimestamp" },
    }),
    makeColumn({
      id: "col_customers_updated",
      tableId: "tbl_customers",
      name: "updated_at",
      type: { kind: "timestamp" },
      isNullable: true,
    }),
    makeColumn({
      id: "col_customers_note",
      tableId: "tbl_customers",
      name: "note",
      type: { kind: "text" },
      isNullable: true,
      comment: "Free text, it's optional",
    }),
    makeColumn({
      id: "col_items_order",
      tableId: "tbl_items",
      name: "order_id",
      type: { kind: "bigint" },
    }),
    makeColumn({ id: "col_items_line", tableId: "tbl_items", name: "line_no" }),
    makeColumn({
      id: "col_items_quantity",
      tableId: "tbl_items",
      name: "quantity",
      defaultValue: { kind: "literal", value: "1" },
    }),
    makeColumn({
      id: "col_orders_id",
      tableId: "tbl_orders",
      name: "id",
      type: { kind: "bigint" },
      isAutoIncrement: true,
    }),
    makeColumn({
      id: "col_orders_number",
      tableId: "tbl_orders",
      name: "number",
      type: { kind: "varchar", length: 20 },
    }),
    makeColumn({
      id: "col_orders_customer",
      tableId: "tbl_orders",
      name: "customer_id",
      type: { kind: "bigint" },
    }),
    makeColumn({
      id: "col_orders_status",
      tableId: "tbl_orders",
      name: "status",
      type: { kind: "enum", enumId: "enum_status" },
      defaultValue: { kind: "literal", value: "pending" },
    }),
    makeColumn({
      id: "col_orders_total",
      tableId: "tbl_orders",
      name: "total",
      type: { kind: "decimal", precision: 12, scale: 2 },
      defaultValue: { kind: "literal", value: "0.00" },
    }),
  ],
  indexes: [
    makeIndex({
      id: "idx_orders_customer",
      tableId: "tbl_orders",
      name: "orders_customer_id_idx",
      columnIds: ["col_orders_customer"],
    }),
    makeIndex({
      id: "idx_orders_number",
      tableId: "tbl_orders",
      name: "uq_orders_number",
      columnIds: ["col_orders_number"],
      isUnique: true,
    }),
  ],
  relations: [
    makeRelation({
      id: "rel_items_orders",
      fromTableId: "tbl_items",
      toTableId: "tbl_orders",
      columnPairs: [
        { fromColumnId: "col_items_order", toColumnId: "col_orders_id" },
      ],
      onDelete: "cascade",
    }),
    makeRelation({
      id: "rel_orders_customers",
      fromTableId: "tbl_orders",
      toTableId: "tbl_customers",
      columnPairs: [
        { fromColumnId: "col_orders_customer", toColumnId: "col_customers_id" },
      ],
    }),
  ],
});

// Ids follow createImportTestOptions(): the enum, then tables, then columns.
export const MYSQLDUMP_EXPECTED_DIAGNOSTICS: readonly ImportDiagnostic[] = [
  {
    code: "type-approximated",
    location: { line: 26, column: 3 },
    path: ["columns", "col_5", "type"],
  },
  {
    code: "type-parameter-dropped",
    location: { line: 27, column: 3 },
    path: ["columns", "col_6", "type"],
  },
  {
    code: "on-update-not-supported",
    location: { line: 30, column: 3 },
    path: ["columns", "col_9"],
  },
  {
    code: "type-approximated",
    location: { line: 31, column: 3 },
    path: ["columns", "col_10", "type"],
  },
  {
    code: "data-statements-ignored",
    location: { line: 41, column: 1 },
    path: null,
  },
  {
    code: "type-approximated",
    location: { line: 55, column: 3 },
    path: ["columns", "col_12", "type"],
  },
  {
    code: "type-approximated",
    location: { line: 72, column: 3 },
    path: ["columns", "col_16", "type"],
  },
];
