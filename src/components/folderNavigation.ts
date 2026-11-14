/** Compose published entries into a folder tree without relying on their URL hierarchy. */
import type { z } from "zod";
import type { navigationSchema } from "../collections/sidebar.mjs";
import { collectionEntryUrl } from "../collections/definition.mjs";

export type Navigation = z.infer<typeof navigationSchema>;
type SortBy = Navigation["sortRules"][number]["sortBy"];

export type NavigationEntry = {
  id: string;
  data: { title: string; publishDate?: Date; navigation?: Navigation };
};

export type NavigationNode = {
  label: string;
  folderName?: string;
  href?: string;
  folder: boolean;
  sortBy?: SortBy;
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
  const sortRules = new Map<string, SortBy>();
  const noteEntries = new Map<NavigationNode, NavigationEntry>();

  for (const entry of entries) {
    const descriptor = entry.data.navigation;
    if (!descriptor) continue;
    const ownTree = descriptor.root.slug === navigation.root.slug;
    const parentTree = descriptor.parent?.root.slug === navigation.root.slug;
    if (!ownTree && !parentTree) continue;

    const location = ownTree ? descriptor : descriptor.parent!;
    const folders = location.folders;
    for (const rule of location.sortRules) {
      sortRules.set(rule.folders.join("/"), rule.sortBy);
    }
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
      const note = { label: entry.data.title, href, folder: false, children: [] };
      folder.children.push(note);
      noteEntries.set(note, entry);
    }
  }

  const sort = (node: NavigationNode, folders: string[], inheritedSortBy: SortBy) => {
    const sortBy = sortRules.get(folders.join("/")) ?? inheritedSortBy;
    node.sortBy = sortBy;
    const direction = sortBy.startsWith("-") ? -1 : 1;
    node.children.sort((left, right) => {
      if (left.folder !== right.folder) return Number(right.folder) - Number(left.folder);

      const titleOrder = left.label.localeCompare(right.label, "en", { numeric: true });
      if (left.folder) {
        return titleOrder || left.folderName!.localeCompare(right.folderName!, "en");
      }

      const leftEntry = noteEntries.get(left)!;
      const rightEntry = noteEntries.get(right)!;
      const idOrder = leftEntry.id.localeCompare(rightEntry.id, "en");
      if (sortBy === "title" || sortBy === "-title") {
        return direction * titleOrder || idOrder;
      }

      const leftDate = leftEntry.data.publishDate;
      const rightDate = rightEntry.data.publishDate;
      // Missing dates remain last even when chronological order is reversed.
      if (leftDate === undefined && rightDate !== undefined) return 1;
      if (leftDate !== undefined && rightDate === undefined) return -1;
      if (leftDate !== undefined && rightDate !== undefined) {
        const dateOrder = leftDate.getTime() - rightDate.getTime();
        if (dateOrder !== 0) return direction * dateOrder;
      }
      return titleOrder || idOrder;
    });
    for (const child of node.children) {
      if (child.folder) sort(child, [...folders, child.folderName!], sortBy);
    }
  };
  sort(root, [], "title");
  return root;
}

export function containsCurrentPage(node: NavigationNode, currentUrl: string): boolean {
  return node.href === currentUrl || node.children.some((child) => containsCurrentPage(child, currentUrl));
}

/** Date-sorted folders link chronologically; other folders follow their list order. */
export function getFolderPageLinks(
  tree: NavigationNode,
  currentUrl: string,
): { previous?: NavigationNode; next?: NavigationNode } {
  const notes = tree.children.filter((child) => !child.folder);
  const chronological = tree.sortBy === "publishDate" || tree.sortBy === "-publishDate";
  if (tree.sortBy === "-publishDate") notes.reverse();
  if (tree.href === currentUrl) {
    return { next: notes[0] };
  }

  const index = notes.findIndex((note) => note.href === currentUrl);
  if (index !== -1) {
    let previous = notes[index - 1];
    if (index === 0 && tree.href && !chronological) {
      previous = tree;
    }
    return { previous, next: notes[index + 1] };
  }

  for (const child of tree.children) {
    if (child.folder && containsCurrentPage(child, currentUrl)) {
      return getFolderPageLinks(child, currentUrl);
    }
  }
  return {};
}
