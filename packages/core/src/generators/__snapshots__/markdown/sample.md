# Sample

## Enums

### order\_status

- pending
- paid
- shipped

## Tables

### order\_items

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| tenant\_id | uuid | No | | Primary key, Foreign key | |
| order\_number | integer | No | | Primary key, Foreign key | |
| line\_number | integer | No | | Primary key | |
| quantity | integer | No | 1 | | |

#### Relations

Outgoing

- tenant\_id, order\_number → orders.tenant\_id, order\_number (One to many, ON DELETE CASCADE, ON UPDATE NO ACTION)

### orders

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| tenant\_id | uuid | No | | Primary key | |
| order\_number | integer | No | | Primary key | |
| status | order\_status | No | pending | | |
| total | decimal\(12,2\) | No | 0\.00 | | |
| user\_id | bigint | No | | Foreign key | |

#### Relations

Outgoing

- user\_id → users.id (One to many, ON DELETE NO ACTION, ON UPDATE NO ACTION)

Incoming

- order\_items.tenant\_id, order\_number → tenant\_id, order\_number (One to many, ON DELETE CASCADE, ON UPDATE NO ACTION)

### tags

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | uuid | No | | Primary key | |

#### Relations

Incoming

- user\_tags.tags\_id → id (One to many, ON DELETE CASCADE, ON UPDATE NO ACTION)

### tenants

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | uuid | No | gen\_random\_uuid\(\) | Primary key | |

#### Relations

Incoming

- users.tenant\_id → id (One to many, ON DELETE CASCADE, ON UPDATE NO ACTION)

### user\_profiles

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| user\_id | bigint | No | | Primary key, Foreign key | |
| bio | text | Yes | | | |

#### Relations

Outgoing

- user\_id → users.id (One to one, ON DELETE CASCADE, ON UPDATE NO ACTION)

### user\_tags

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| users\_id | bigint | No | | Primary key, Foreign key | |
| tags\_id | uuid | No | | Primary key, Foreign key | |
| assigned\_at | timestamptz | No | now\(\) | | |

#### Relations

Outgoing

- users\_id → users.id (One to many, ON DELETE CASCADE, ON UPDATE NO ACTION)
- tags\_id → tags.id (One to many, ON DELETE CASCADE, ON UPDATE NO ACTION)

### users

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | bigint | No | | Primary key, Auto increment | |
| tenant\_id | uuid | No | | Foreign key | |
| email | varchar\(255\) | No | | | |
| manager\_id | bigint | Yes | | Foreign key | |
| created\_at | timestamptz | No | now\(\) | | |
| location | geometry\(Point, 4326\) | Yes | | | |

#### Indexes

| Name | Columns | Unique |
|---|---|---|
| users\_tenant\_id\_email\_key | tenant\_id, email | Yes |

#### Relations

Outgoing

- tenant\_id → tenants.id (One to many, ON DELETE CASCADE, ON UPDATE NO ACTION)
- manager\_id → users.id (One to many, ON DELETE SET NULL, ON UPDATE NO ACTION)

Incoming

- orders.user\_id → id (One to many, ON DELETE NO ACTION, ON UPDATE NO ACTION)
- user\_profiles.user\_id → id (One to one, ON DELETE CASCADE, ON UPDATE NO ACTION)
- user\_tags.users\_id → id (One to many, ON DELETE CASCADE, ON UPDATE NO ACTION)
- users.manager\_id → id (One to many, ON DELETE SET NULL, ON UPDATE NO ACTION)
