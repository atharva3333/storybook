import Vue, { VueConstructor, ComponentOptions } from 'vue';
import type { DecoratorFunction, StoryContext, LegacyStoryFn } from '@storybook/csf';
import { sanitizeStoryContextUpdate } from '@storybook/store';

import type { StoryFnVueReturnType, VueFramework } from './types';
import { extractProps } from './util';
import { VALUES } from './render';

export const WRAPS = 'STORYBOOK_WRAPS';

function prepare(
  rawStory: StoryFnVueReturnType,
  innerStory?: StoryFnVueReturnType,
  context?: StoryContext<VueFramework>
): VueConstructor | null {
  let story: ComponentOptions<Vue> | VueConstructor;

  if (typeof rawStory === 'string') {
    story = { template: rawStory };
  } else if (rawStory != null) {
    story = rawStory as ComponentOptions<Vue>;
  } else {
    return null;
  }

  // @ts-expect-error (Converted from ts-ignore)
  // eslint-disable-next-line no-underscore-dangle
  if (!story._isVue) {
    if (innerStory) {
      story.components = { ...(story.components || {}), story: innerStory };
    }
    story = Vue.extend(story);
    // @ts-expect-error // https://github.com/storybookjs/storybook/pull/7578#discussion_r307984824
  } else if (story.options[WRAPS]) {
    return story as VueConstructor;
  }

  return Vue.extend({
    // @ts-expect-error // https://github.com/storybookjs/storybook/pull/7578#discussion_r307985279
    [WRAPS]: story,
    [VALUES]: {
      // @ts-expect-error // https://github.com/storybookjs/storybook/pull/7578#discussion_r307984824
      ...(innerStory ? innerStory.options[VALUES] : {}),
      // @ts-expect-error // https://github.com/storybookjs/storybook/pull/7578#discussion_r307984824
      ...extractProps(story),
      ...(context?.args || {}),
    },
    functional: true,
    render(h, { data, parent, children }) {
      return h(
        story,
        {
          ...data,
          // @ts-expect-error // https://github.com/storybookjs/storybook/pull/7578#discussion_r307986196
          props: { ...(data.props || {}), ...parent.$root[VALUES] },
        },
        children
      );
    },
  });
}

export function decorateStory(
  storyFn: LegacyStoryFn<VueFramework>,
  decorators: DecoratorFunction<VueFramework>[]
) {
  return decorators.reduce(
    (decorated: LegacyStoryFn<VueFramework>, decorator) => (context: StoryContext<VueFramework>) => {
      let story: VueFramework['storyResult'] | undefined;

      const decoratedStory = decorator((update) => {
        story = decorated({ ...context, ...sanitizeStoryContextUpdate(update) });
        return story;
      }, context);

      if (!story) {
        story = decorated(context);
      }

      if (decoratedStory === story) {
        return story;
      }

      return prepare(decoratedStory, story) as VueFramework['storyResult'];
    },
    (context) => {
      return prepare(storyFn(context), undefined, context) as VueFramework['storyResult'];
    }
  );
}
