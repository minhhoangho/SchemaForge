// Every DBML feature the model cannot hold, one per line, so each diagnostic of
// importDbml has a known line and column. Line 1 is the Project line.
export const DBML_FEATURES_FIXTURE = `Project features {
  Note: 'Dropped project note'
}

Enum status {
  active [note: 'Dropped value note']
  archived
}

Table sales.orders [headercolor: #3498DB] {
  id integer [pk, increment]
  total decimal(12,2) [default: 12345678901234567890.123, check: \`total >= 0\`]
  state status [default: \`random()\`]
  code "tsvector"
  indexes {
    (code) [type: hash, note: 'Dropped index note']
    (\`lower(code)\`) [name: 'orders_lower_code']
  }
  checks {
    \`total < 1000000\`
  }
}

Table tags {
  id integer [pk]
}

Ref: sales.orders.code <> tags.id
Ref: tags.id - sales.orders.id [color: #79AD51]

TableGroup sales [color: #79AD51, note: 'Dropped group note'] {
  sales.orders
}

Note release {
  'Imported from the features fixture'
}

records tags(id) {
  1
}
`;
