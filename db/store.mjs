export async function readWorkspace(db){
  if(!db)throw Error('Workspace storage is unavailable.');
  const row=await db.prepare('SELECT revision, content, updated_at FROM workspaces WHERE id = ?').bind('main').first();
  return row?{revision:row.revision,workspace:JSON.parse(row.content),updatedAt:row.updated_at}:{revision:0,workspace:null,updatedAt:null};
}
export async function writeWorkspace(db,workspace,expectedRevision){
  if(!db)throw Error('Workspace storage is unavailable.');
  const content=JSON.stringify(workspace),now=Date.now();
  const statement=expectedRevision===0
    ?db.prepare('INSERT INTO workspaces (id, revision, content, updated_at) VALUES (?, 1, ?, ?) ON CONFLICT(id) DO NOTHING RETURNING revision').bind('main',content,now)
    :db.prepare('UPDATE workspaces SET content = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? RETURNING revision').bind(content,now,'main',expectedRevision);
  const row=await statement.first();return row?{revision:row.revision,updatedAt:now}:null;
}
