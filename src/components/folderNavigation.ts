/** Compose published entries into a folder tree without relying on their URL hierarchy. */
import type { z } from "zod";
import type { navigationSchema } from "../collections/sidebar.mjs";
import { collectionEntryUrl } from "../collections/definition.mjs";

export type Navigation = z.infer<typeof navigationSchema>;
export type NavigationEntry = {
  id: string;
  data: { title: string; navigation?: Navigation };
};

export type NavigationNode = {
  label: string;
  folderName?: string;
  href?: string;
  folder: boolean;
  children: NavigationNode[];
};

export function buildFolderNavigation(
  entries: NavigationEntry[],
  navigation: Navigation,
  route: string,
): NavigationNode {
  const root: NavigationNode = {
    label: navigation.root.title,
    folder: true,
    children: [],
  };

  for (const entry of entries) {
    const descriptor = entry.data.navigation;
    if (!descriptor) continue;
    const ownTree = descriptor.root.slug === navigation.root.slug;
    const parentTree = descriptor.parent?.root.slug === navigation.root.slug;
    if (!ownTree && !parentTree) continue;

    const folders = ownTree ? descriptor.folders : descriptor.parent!.folders;
    let folder = root;
    for (const label of folders) {
      let child = folder.children.find((node) => node.folder && node.folderName === label);
      if (!child) {
        child = { label, folderName: label, folder: true, children: [] };
        folder.children.push(child);
      }
      folder = child;
    }

    const href = collectionEntryUrl(route, entry.id);
    if (descriptor.overview) {
      folder.href = href;
      folder.label = entry.data.title;
    } else {
      folder.children.push({ label: entry.data.title, href, folder: false, children: [] });
    }
  }

  const sort = (node: NavigationNode) => {
    node.children.sort((left, right) =>
      Number(right.folder) - Number(left.folder) ||
      left.label.localeCompare(right.label, "en", { numeric: true }),
    );
    node.children.forEach(sort);
  };
  sort(root);
  return root;
}

export function containsCurrentPage(node: NavigationNode, currentUrl: string): boolean {
  return node.href === currentUrl || node.children.some((child) => containsCurrentPage(child, currentUrl));
}
