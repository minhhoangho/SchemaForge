# Target limits

## Enums

### flag\_status

- active
- inactive

## Tables

### all\_types

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| smallint\_value | smallint | No | \-32768 | | |
| integer\_value | integer | No | 42 | | |
| bigint\_value | bigint | No | 9223372036854775807 | | |
| decimal\_value | decimal\(12,2\) | No | 1234567890\.12 | | |
| real\_value | real | No | 1\.5e10 | | |
| double\_value | double | No | \-2\.25 | | |
| boolean\_value | boolean | No | true | | |
| char\_value | char\(3\) | No | abc | | |
| varchar\_value | varchar\(20\) | No | it's | | |
| text\_value | text | No | a\\b | | |
| uuid\_value | uuid | No | 123e4567\-e89b\-12d3\-a456\-426614174000 | | |
| date\_value | date | No | 2026\-01\-02 | | |
| time\_value | time | No | 12:34:56\.789 | | |
| timestamp\_value | timestamp | No | 2026\-01\-02T03:04:05 | | |
| timestamptz\_value | timestamptz | No | 2026\-01\-02T03:04:05\.123\+07:00 | | |
| timestamp\_now | timestamp | No | now\(\) | | |
| timestamptz\_now | timestamptz | No | now\(\) | | |
| json\_value | json | No | \{"note":"it's"\} | | |
| binary\_value | binary | Yes | | | |
| enum\_value | flag\_status | No | active | | |

### auto\_integer

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key, Auto increment | |

### auto\_smallint

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | smallint | No | | Primary key, Auto increment | |

### auto\_trailing

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| a | integer | No | | Primary key | |
| id | bigint | No | | Primary key, Auto increment | |

### auto\_wide\_key

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | bigint | No | | Primary key, Auto increment | |
| code\_a | varchar\(700\) | No | | Primary key | |
| code\_b | varchar\(700\) | No | | Primary key | |

### binary\_keys

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| hash | binary | No | | | |

#### Indexes

| Name | Columns | Unique |
|---|---|---|
| binary\_keys\_hash\_ux | hash | Yes |

### char\_unique

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| code | char\(300\) | No | | Unique | |

### custom\_required

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| payload | tsvector | No | | | |

### custom\_values

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| shape | geometry\(Point, 4326\) | Yes | | | |
| address | inet | No | 127\.0\.0\.1 | | |

### cycle\_a

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| b\_id | integer | Yes | | Foreign key | |

#### Relations

Outgoing

- b\_id → cycle\_b.id (One to many, ON DELETE CASCADE, ON UPDATE NO ACTION)

Incoming

- cycle\_b.a\_id → id (One to many, ON DELETE CASCADE, ON UPDATE NO ACTION)

### cycle\_b

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| a\_id | integer | Yes | | Foreign key | |

#### Relations

Outgoing

- a\_id → cycle\_a.id (One to many, ON DELETE CASCADE, ON UPDATE NO ACTION)

Incoming

- cycle\_a.b\_id → id (One to many, ON DELETE CASCADE, ON UPDATE NO ACTION)

### default\_children

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| parent\_id | integer | No | 0 | Foreign key | |

#### Relations

Outgoing

- parent\_id → default\_parents.id (One to many, ON DELETE SET DEFAULT, ON UPDATE NO ACTION)

### default\_parents

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |

#### Relations

Incoming

- default\_children.parent\_id → id (One to many, ON DELETE SET DEFAULT, ON UPDATE NO ACTION)

### five\_part\_keys

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| q1 | varchar\(700\) | No | | | |
| q2 | varchar\(700\) | No | | | |
| q3 | varchar\(700\) | No | | | |
| q4 | varchar\(700\) | No | | | |
| q5 | varchar\(700\) | No | | | |

#### Indexes

| Name | Columns | Unique |
|---|---|---|
| five\_part\_keys\_ux | q1, q2, q3, q4, q5 | Yes |

#### Relations

Incoming

- five\_part\_refs.q1, q2, q3, q4, q5 → q1, q2, q3, q4, q5 (One to many, ON DELETE NO ACTION, ON UPDATE NO ACTION)

### five\_part\_refs

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| q1 | varchar\(700\) | No | | Foreign key | |
| q2 | varchar\(700\) | No | | Foreign key | |
| q3 | varchar\(700\) | No | | Foreign key | |
| q4 | varchar\(700\) | No | | Foreign key | |
| q5 | varchar\(700\) | No | | Foreign key | |

#### Relations

Outgoing

- q1, q2, q3, q4, q5 → five\_part\_keys.q1, q2, q3, q4, q5 (One to many, ON DELETE NO ACTION, ON UPDATE NO ACTION)

### fixed\_keys

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| code | char\(500\) | No | | Primary key | |

#### Relations

Incoming

- fixed\_refs.fixed\_code → code (One to many, ON DELETE NO ACTION, ON UPDATE NO ACTION)

### fixed\_refs

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| fixed\_code | char\(500\) | No | | Foreign key | |

#### Relations

Outgoing

- fixed\_code → fixed\_keys.code (One to many, ON DELETE NO ACTION, ON UPDATE NO ACTION)

### fixed\_unique

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| code | char\(900\) | No | | Unique | |

### flags

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| status | flag\_status | Yes | | | |
| is\_primary | boolean | No | | Unique | |

### four\_part\_keys

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| p1 | varchar\(192\) | No | | | |
| p2 | varchar\(192\) | No | | | |
| p3 | varchar\(192\) | No | | | |
| p4 | varchar\(192\) | No | | | |

#### Indexes

| Name | Columns | Unique |
|---|---|---|
| four\_part\_keys\_ux | p1, p2, p3, p4 | Yes |

### fractional\_times

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| starts\_at | time | No | 12:34:56\.123456789 | | |
| created\_at | timestamp | No | 2026\-01\-02T03:04:05\.12345678 | | |

### json\_keys

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| doc | json | No | | Primary key | |

### json\_refs

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| doc | json | No | | Foreign key | |

#### Relations

Outgoing

- doc → json\_unique.doc (One to many, ON DELETE NO ACTION, ON UPDATE NO ACTION)

### json\_unique

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| doc | json | No | | Unique | |

#### Relations

Incoming

- json\_refs.doc → doc (One to many, ON DELETE NO ACTION, ON UPDATE NO ACTION)

### leaf

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| left\_id | integer | No | | Foreign key | |
| right\_id | integer | No | | Foreign key | |

#### Relations

Outgoing

- left\_id → left.id (One to many, ON DELETE CASCADE, ON UPDATE NO ACTION)
- right\_id → right.id (One to many, ON DELETE CASCADE, ON UPDATE NO ACTION)

Incoming

- root.leaf\_id → id (One to many, ON DELETE RESTRICT, ON UPDATE NO ACTION)

### left

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| root\_id | integer | No | | Foreign key | |

#### Relations

Outgoing

- root\_id → root.id (One to many, ON DELETE CASCADE, ON UPDATE NO ACTION)

Incoming

- leaf.left\_id → id (One to many, ON DELETE CASCADE, ON UPDATE NO ACTION)

### long\_comments

ttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| note | text | No | | | ccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc |
| surrogate\_note | text | No | | | sssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss😀 |

### long\_unique

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| code | varchar\(1000\) | No | | Unique | |

### no\_key\_rows

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| note | text | No | | | |
| value | integer | No | | | |

### nullable\_unique

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| code | varchar\(20\) | Yes | | Unique | |
| alt\_code | varchar\(20\) | Yes | | | |

#### Indexes

| Name | Columns | Unique |
|---|---|---|
| nullable\_unique\_alt\_code\_ux | alt\_code | Yes |

#### Relations

Incoming

- nullable\_unique\_refs.code → code (One to many, ON DELETE NO ACTION, ON UPDATE NO ACTION)

### nullable\_unique\_refs

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| code | varchar\(20\) | Yes | | Foreign key | |

#### Relations

Outgoing

- code → nullable\_unique.code (One to many, ON DELETE NO ACTION, ON UPDATE NO ACTION)

### oversized\_types

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| pg\_varchar | varchar\(10485761\) | No | | | |
| mysql\_char | char\(256\) | No | | | |
| mysql\_varchar | varchar\(16384\) | No | | | |
| sqlserver\_char | char\(4001\) | No | | | |
| sqlserver\_varchar | varchar\(4001\) | No | | | |
| pg\_decimal | decimal\(1001,2\) | No | | | |
| mysql\_decimal | decimal\(40,31\) | No | | | |

### oversized\_unique

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| code | varchar\(20000\) | No | | Unique | |

### required\_a

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| b\_id | integer | No | | Foreign key | |

#### Relations

Outgoing

- b\_id → required\_b.id (One to many, ON DELETE NO ACTION, ON UPDATE NO ACTION)

Incoming

- required\_b.a\_id → id (One to many, ON DELETE NO ACTION, ON UPDATE NO ACTION)
- required\_child.a\_id → id (One to many, ON DELETE NO ACTION, ON UPDATE NO ACTION)

### required\_b

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| a\_id | integer | No | | Foreign key | |

#### Relations

Outgoing

- a\_id → required\_a.id (One to many, ON DELETE NO ACTION, ON UPDATE NO ACTION)

Incoming

- required\_a.b\_id → id (One to many, ON DELETE NO ACTION, ON UPDATE NO ACTION)

### required\_child

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| a\_id | integer | No | | Foreign key | |

#### Relations

Outgoing

- a\_id → required\_a.id (One to many, ON DELETE NO ACTION, ON UPDATE NO ACTION)

### right

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| root\_id | integer | No | | Foreign key | |

#### Relations

Outgoing

- root\_id → root.id (One to many, ON DELETE CASCADE, ON UPDATE NO ACTION)

Incoming

- leaf.right\_id → id (One to many, ON DELETE CASCADE, ON UPDATE NO ACTION)

### root

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| leaf\_id | integer | Yes | | Foreign key | |

#### Relations

Outgoing

- leaf\_id → leaf.id (One to many, ON DELETE RESTRICT, ON UPDATE NO ACTION)

Incoming

- left.root\_id → id (One to many, ON DELETE CASCADE, ON UPDATE NO ACTION)
- right.root\_id → id (One to many, ON DELETE CASCADE, ON UPDATE NO ACTION)

### text\_keys

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| code | text | No | | Primary key | |
| label | text | No | | Unique | |
| tag | text | No | | | |

#### Indexes

| Name | Columns | Unique |
|---|---|---|
| text\_keys\_tag\_ix | tag | No |

#### Relations

Incoming

- text\_refs.text\_key\_code → code (One to many, ON DELETE NO ACTION, ON UPDATE NO ACTION)

### text\_refs

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| text\_key\_code | text | No | | Foreign key | |

#### Relations

Outgoing

- text\_key\_code → text\_keys.code (One to many, ON DELETE NO ACTION, ON UPDATE NO ACTION)

### tree\_nodes

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| parent\_id | integer | Yes | | Foreign key | |

#### Relations

Outgoing

- parent\_id → tree\_nodes.id (One to many, ON DELETE SET NULL, ON UPDATE NO ACTION)

Incoming

- tree\_nodes.parent\_id → id (One to many, ON DELETE SET NULL, ON UPDATE NO ACTION)

### unique\_only

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| code | varchar\(20\) | No | | Unique | |
| label | text | No | | | |

### wide\_rows

| Name | Type | Nullable | Default | Constraints | Comment |
|---|---|---|---|---|---|
| id | integer | No | | Primary key | |
| v | varchar\(16383\) | No | | | |
