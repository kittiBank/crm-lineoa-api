import { MessageBlockDto } from './dto/message-block.dto';

export const MERGE_TAG_DEFINITIONS = [
  {
    key: 'lineUser',
    field: 'displayName',
    description: 'LINE display name',
    example: 'สมชาย',
  },
  {
    key: 'userTier',
    field: 'userTier',
    description: 'Member tier (Silver, Gold, Platinum)',
    example: 'Gold',
  },
  {
    key: 'userType',
    field: 'userType',
    description: 'Guest or Member',
    example: 'Member',
  },
  {
    key: 'phone',
    field: 'phone',
    description: 'Verified phone number',
    example: '0812345678',
  },
  {
    key: 'displayName',
    field: 'displayName',
    description: 'Alias of lineUser',
    example: 'สมชาย',
  },
  {
    key: 'pictureUrl',
    field: 'pictureUrl',
    description: 'LINE profile picture URL',
    example: 'https://profile.line-scdn.net/example',
  },
  {
    key: 'lineUserId',
    field: 'lineUserId',
    description: 'LINE user ID',
    example: 'U1234567890abcdef',
  },
] as const;

const MERGEABLE_MESSAGE_TYPES = new Set(['text', 'flex']);
const KNOWN_TAG_KEYS = new Set(
  MERGE_TAG_DEFINITIONS.flatMap((tag) => [tag.key, tag.key.toLowerCase()]),
);
const MERGE_TAG_PATTERN_SOURCE = '\\{([a-zA-Z0-9_]+)\\}';

function mergeTagPattern() {
  return new RegExp(MERGE_TAG_PATTERN_SOURCE, 'g');
}

export type LineUserMergeSource = {
  lineUserId?: string | null;
  displayName?: string | null;
  pictureUrl?: string | null;
  userType?: string | null;
  userTier?: string | null;
  phone?: string | null;
} | null;

export type MergeTagValues = Record<string, string>;

export function buildMergeTagValues(
  user: LineUserMergeSource,
): MergeTagValues {
  const displayName = user?.displayName?.trim() || 'ลูกค้า';
  const values: MergeTagValues = {
    lineUser: displayName,
    displayName,
    userTier: user?.userTier?.trim() || '',
    userType: user?.userType?.trim() || 'Guest',
    phone: user?.phone?.trim() || '',
    pictureUrl: user?.pictureUrl?.trim() || '',
    lineUserId: user?.lineUserId?.trim() || '',
  };

  for (const [key, value] of Object.entries(values)) {
    values[key.toLowerCase()] = value;
  }

  return values;
}

export function applyMergeTags(text: string, values: MergeTagValues): string {
  return text.replace(mergeTagPattern(), (match, key: string) => {
    const replacement = values[key] ?? values[key.toLowerCase()];
    return replacement !== undefined ? replacement : match;
  });
}

export function applyMergeTagsToValue<T>(value: T, values: MergeTagValues): T {
  if (typeof value === 'string') {
    return applyMergeTags(value, values) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => applyMergeTagsToValue(item, values)) as T;
  }

  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      next[key] = applyMergeTagsToValue(nested, values);
    }
    return next as T;
  }

  return value;
}

export function applyMergeTagsToMessageBlocks(
  blocks: MessageBlockDto[],
  values: MergeTagValues,
): MessageBlockDto[] {
  return blocks.map((block) => {
    if (!MERGEABLE_MESSAGE_TYPES.has(block.type)) {
      return block;
    }

    return applyMergeTagsToValue(block, values);
  });
}

export function messageBlocksHaveMergeTags(blocks: MessageBlockDto[]): boolean {
  return blocks.some(
    (block) =>
      MERGEABLE_MESSAGE_TYPES.has(block.type) && containsKnownMergeTags(block),
  );
}

function containsKnownMergeTags(value: unknown): boolean {
  if (typeof value === 'string') {
    for (const match of value.matchAll(mergeTagPattern())) {
      if (KNOWN_TAG_KEYS.has(match[1]) || KNOWN_TAG_KEYS.has(match[1].toLowerCase())) {
        return true;
      }
    }
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsKnownMergeTags(item));
  }

  if (value && typeof value === 'object') {
    return Object.values(value).some((item) => containsKnownMergeTags(item));
  }

  return false;
}

export function listMergeTags() {
  return MERGE_TAG_DEFINITIONS.filter((tag) => tag.key !== 'displayName').map(
    (tag) => ({
      tag: `{${tag.key}}`,
      key: tag.key,
      field: tag.field,
      description: tag.description,
      example: tag.example,
    }),
  );
}
