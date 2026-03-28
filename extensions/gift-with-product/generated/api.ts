export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type Cart = {
  __typename?: 'Cart';
  lines: Array<CartLine>;
};

export type CartLine = {
  __typename?: 'CartLine';
  id: Scalars['ID']['output'];
  merchandise: Merchandise;
  quantity: Scalars['Int']['output'];
};

export type CartTransform = {
  __typename?: 'CartTransform';
  metafield?: Maybe<Metafield>;
};


export type CartTransformMetafieldArgs = {
  key: Scalars['String']['input'];
  namespace: Scalars['String']['input'];
};

export type Input = {
  __typename?: 'Input';
  cart: Cart;
  cartTransform: CartTransform;
  shop: Shop;
};

export type Merchandise = ProductVariant;

export type Metafield = {
  __typename?: 'Metafield';
  value: Scalars['String']['output'];
};

export type ProductVariant = {
  __typename?: 'ProductVariant';
  id: Scalars['ID']['output'];
};

export type Shop = {
  __typename?: 'Shop';
  metafield?: Maybe<Metafield>;
};


export type ShopMetafieldArgs = {
  key: Scalars['String']['input'];
  namespace: Scalars['String']['input'];
};

export type CartTransformInputVariables = Exact<{ [key: string]: never; }>;


export type CartTransformInput = { __typename?: 'Input', cart: { __typename?: 'Cart', lines: Array<{ __typename?: 'CartLine', id: string, quantity: number, merchandise: { __typename?: 'ProductVariant', id: string } }> }, shop: { __typename?: 'Shop', metafield?: { __typename?: 'Metafield', value: string } | null } };
