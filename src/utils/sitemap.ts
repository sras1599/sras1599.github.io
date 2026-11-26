export interface SitemapRoute {
  url: string;
  title: string;
  directory?: {
    folders: { key: string; label: string }[];
    overview: boolean;
  };
}

export interface SitemapNode {
  label: string;
  href?: string;
  children?: Map<string, SitemapNode>;
}

export function countSitemapFolders(nodes: Iterable<SitemapNode>): number {
  let count = 0;
  for (const { children } of nodes) {
    if (children?.size) count += 1 + countSitemapFolders(children.values());
  }
  return count;
}

export function sortSitemapNodes(nodes: Iterable<SitemapNode>): SitemapNode[] {
  return [...nodes].sort((left, right) =>
    left.label.localeCompare(right.label, "en", { numeric: true }),
  );
}

export function buildSitemapTree(routes: SitemapRoute[]): SitemapNode[] {
  const root = new Map<string, SitemapNode>();

  for (const { url, title, directory } of routes) {
    let children = root;
    let folder: SitemapNode | undefined;

    for (const { key, label } of directory?.folders ?? []) {
      folder = children.get(key);
      if (!folder) {
        folder = { label };
        children.set(key, folder);
      }
      folder.children ??= new Map();
      children = folder.children;
    }

    if (folder && directory?.overview) {
      folder.label = title;
      folder.href = url;
    } else {
      children.set(`page:${url}`, { label: title, href: url });
    }
  }

  return sortSitemapNodes(root.values());
}
