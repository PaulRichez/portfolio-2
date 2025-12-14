import type { Schema, Struct } from '@strapi/strapi';

export interface MeCodingSkill extends Struct.ComponentSchema {
  collectionName: 'components_me_coding_skills';
  info: {
    displayName: 'coding_skill';
    icon: 'code';
  };
  attributes: {
    coding: Schema.Attribute.Relation<'oneToOne', 'api::coding.coding'>;
    level: Schema.Attribute.Enumeration<
      ['beginner', 'intermediate', 'advanced', 'expert']
    > &
      Schema.Attribute.Required;
  };
}

export interface MeDiplomas extends Struct.ComponentSchema {
  collectionName: 'components_me_diplomas';
  info: {
    displayName: 'diplomas';
    icon: 'crown';
  };
  attributes: {
    description: Schema.Attribute.Text;
    endDate: Schema.Attribute.Date & Schema.Attribute.Required;
    startDate: Schema.Attribute.Date & Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface MeExperiences extends Struct.ComponentSchema {
  collectionName: 'components_me_experiences';
  info: {
    displayName: 'experiences';
    icon: 'earth';
  };
  attributes: {
    business: Schema.Attribute.String & Schema.Attribute.Required;
    businessWebsite: Schema.Attribute.String;
    descriptions: Schema.Attribute.JSON;
    endDate: Schema.Attribute.Date;
    startDate: Schema.Attribute.Date & Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface MeLanguages extends Struct.ComponentSchema {
  collectionName: 'components_me_languages';
  info: {
    displayName: 'languages';
    icon: 'italic';
  };
  attributes: {
    name: Schema.Attribute.String & Schema.Attribute.Required;
    value: Schema.Attribute.Integer;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'me.coding-skill': MeCodingSkill;
      'me.diplomas': MeDiplomas;
      'me.experiences': MeExperiences;
      'me.languages': MeLanguages;
    }
  }
}
