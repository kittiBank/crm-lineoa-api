import * as line from '@line/bot-sdk';
import { MessageBlockDto } from '../templates/dto/message-block.dto';

const MESSAGE_TYPES = new Set([
  'text',
  'image',
  'video',
  'flex',
  'carousel',
]);

export function parseTemplateMessageBlocks(
  messages: unknown,
  content?: string,
): MessageBlockDto[] {
  const candidates = [messages, tryParseJson(content)];

  for (const candidate of candidates) {
    const parsed = normalizeMessageBlocks(candidate);
    if (parsed.length > 0) {
      return parsed;
    }
  }

  return [];
}

function tryParseJson(value?: string): unknown {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeMessageBlocks(value: unknown): MessageBlockDto[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is MessageBlockDto =>
      Boolean(item) &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      typeof (item as MessageBlockDto).type === 'string' &&
      MESSAGE_TYPES.has((item as MessageBlockDto).type),
  );
}

export function buildLineMessages(blocks: MessageBlockDto[]): line.Message[] {
  const messages: line.Message[] = [];

  for (const block of blocks.slice(0, 5)) {
    const message = buildLineMessage(block);
    if (message) {
      messages.push(message);
    }
  }

  return messages;
}

function buildLineMessage(block: MessageBlockDto): line.Message | null {
  switch (block.type) {
    case 'text':
      if (!block.text?.trim()) {
        return null;
      }
      return { type: 'text', text: block.text.trim() };

    case 'image':
      if (!block.imageUrl?.trim()) {
        return null;
      }
      return {
        type: 'image',
        originalContentUrl: block.imageUrl.trim(),
        previewImageUrl: block.imageUrl.trim(),
      };

    case 'video':
      if (!block.videoUrl?.trim()) {
        return null;
      }
      return {
        type: 'video',
        originalContentUrl: block.videoUrl.trim(),
        previewImageUrl:
          block.previewImageUrl?.trim() || block.videoUrl.trim(),
      };

    case 'flex':
      return buildFlexMessage(block);

    case 'carousel':
      return buildCarouselMessage(block);

    default:
      return null;
  }
}

function buildFlexMessage(block: MessageBlockDto): line.FlexMessage | null {
  const altText = block.altText?.trim() || block.title?.trim() || 'Message';
  const bodyContents: line.FlexComponent[] = [];

  if (block.title?.trim()) {
    bodyContents.push({
      type: 'text',
      text: block.title.trim(),
      weight: 'bold',
      size: 'lg',
      wrap: true,
    });
  }

  if (block.description?.trim()) {
    bodyContents.push({
      type: 'text',
      text: block.description.trim(),
      wrap: true,
      margin: 'md',
    });
  }

  if (bodyContents.length === 0) {
    return null;
  }

  const bubble: line.FlexBubble = {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: bodyContents,
    },
  };

  if (block.imageUrl?.trim()) {
    bubble.hero = {
      type: 'image',
      url: block.imageUrl.trim(),
      size: 'full',
      aspectMode: 'cover',
      aspectRatio: '20:13',
    };
  }

  if (block.buttonLabel?.trim() && block.buttonUrl?.trim()) {
    bubble.footer = {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          style: 'primary',
          action: {
            type: 'uri',
            label: block.buttonLabel.trim(),
            uri: block.buttonUrl.trim(),
          },
        },
      ],
    };
  }

  return {
    type: 'flex',
    altText,
    contents: bubble,
  };
}

function buildCarouselMessage(
  block: MessageBlockDto,
): line.FlexMessage | null {
  const columns = block.columns ?? [];
  if (columns.length === 0) {
    return null;
  }

  const bubbles: line.FlexBubble[] = columns
    .map((column) => {
      const bodyContents: line.FlexComponent[] = [];

      if (column.title?.trim()) {
        bodyContents.push({
          type: 'text',
          text: column.title.trim(),
          weight: 'bold',
          wrap: true,
        });
      }

      if (column.text?.trim()) {
        bodyContents.push({
          type: 'text',
          text: column.text.trim(),
          wrap: true,
          margin: 'md',
        });
      }

      if (bodyContents.length === 0) {
        return null;
      }

      const bubble: line.FlexBubble = {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: bodyContents,
        },
      };

      if (column.imageUrl?.trim()) {
        bubble.hero = {
          type: 'image',
          url: column.imageUrl.trim(),
          size: 'full',
          aspectMode: 'cover',
          aspectRatio: '20:13',
        };
      }

      if (column.actionLabel?.trim() && column.actionUrl?.trim()) {
        bubble.footer = {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'button',
              style: 'link',
              action: {
                type: 'uri',
                label: column.actionLabel.trim(),
                uri: column.actionUrl.trim(),
              },
            },
          ],
        };
      }

      return bubble;
    })
    .filter((bubble): bubble is line.FlexBubble => bubble !== null);

  if (bubbles.length === 0) {
    return null;
  }

  return {
    type: 'flex',
    altText: block.altText?.trim() || 'Carousel message',
    contents: {
      type: 'carousel',
      contents: bubbles,
    },
  };
}
