function readDirectory(reader: FileSystemDirectoryReader) {
  return new Promise<FileSystemEntry[]>((resolve, reject) => {
    const all: FileSystemEntry[] = []
    const read = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(all)
          return
        }
        all.push(...batch)
        read()
      }, reject)
    }
    read()
  })
}

function fileFromEntry(entry: FileSystemFileEntry) {
  return new Promise<File>((resolve, reject) => {
    entry.file(resolve, reject)
  })
}

async function walkEntry(entry: FileSystemEntry, files: File[]) {
  if (entry.isFile) {
    files.push(await fileFromEntry(entry as FileSystemFileEntry))
    return
  }
  if (!entry.isDirectory) {
    return
  }
  const children = await readDirectory((entry as FileSystemDirectoryEntry).createReader())
  for (const child of children) {
    await walkEntry(child, files)
  }
}

// Files dropped from a folder arrive as directory entries. A plain file drop
// still works when the browser does not expose entries.
export async function filesFromDataTransfer(data: DataTransfer) {
  const entries = Array.from(data.items)
    .map((item) => item.webkitGetAsEntry?.() ?? null)
    .filter((entry): entry is FileSystemEntry => entry != null)

  if (entries.length === 0) {
    return Array.from(data.files)
  }

  const files: File[] = []
  for (const entry of entries) {
    await walkEntry(entry, files)
  }
  return files
}
