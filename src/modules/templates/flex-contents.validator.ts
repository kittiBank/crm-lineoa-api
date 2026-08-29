type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function validateFlexContents(contents: unknown): string | null {
  if (!isObject(contents)) {
    return 'Flex contents must be a JSON object';
  }

  if (contents.type === 'bubble') {
    const sections = ['header', 'hero', 'body', 'footer'];
    if (!sections.some((section) => contents[section] !== undefined)) {
      return 'A Flex bubble must contain header, hero, body, or footer';
    }

    for (const section of sections) {
      if (contents[section] !== undefined && !isObject(contents[section])) {
        return `Flex bubble ${section} must be a JSON object`;
      }
    }

    return null;
  }

  if (contents.type === 'carousel') {
    if (!Array.isArray(contents.contents) || contents.contents.length === 0) {
      return 'A Flex carousel must contain at least one bubble';
    }

    if (contents.contents.length > 12) {
      return 'A Flex carousel can contain up to 12 bubbles';
    }

    if (
      contents.contents.some(
        (bubble) => !isObject(bubble) || bubble.type !== 'bubble',
      )
    ) {
      return 'Every Flex carousel item must be a bubble';
    }

    return null;
  }

  return 'Flex contents type must be "bubble" or "carousel"';
}
