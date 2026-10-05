// A hand-written file in the style of a dbdiagram.io export: unquoted names,
// native type names, inline refs, `//` comments and a Project block.
export const DBDIAGRAM_FIXTURE = `// Docs: https://dbml.dbdiagram.io/docs
Project blog {
  database_type: 'PostgreSQL'
}

Enum post_status {
  draft
  published
}

Table users as U {
  id integer [primary key, increment]
  username varchar(50) [not null, unique]
  role varchar [default: 'member']
  created_at timestamp [default: \`now()\`]
}

Table posts {
  id integer [pk, increment]
  title varchar(200) [not null]
  body text [note: 'Content of the post']
  status post_status [not null, default: 'draft']
  user_id integer [not null, ref: > U.id]
  score numeric(5,2) [default: 0]

  indexes {
    (user_id, status) [name: 'posts_user_status']
    title
  }
  Note: 'Stores posts'
}

Table follows {
  following_user_id integer
  followed_user_id integer
  created_at timestamp
}

Ref: users.id < follows.following_user_id
Ref: users.id < follows.followed_user_id

TableGroup social {
  users
  follows
}
`;
