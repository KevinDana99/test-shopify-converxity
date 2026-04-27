import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Affiliate attribution for Shopify</h1>
        <p className={styles.text}>
          Track checkout conversions, calculate commissions, and review payout
          events from a single embedded admin dashboard.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Web Pixel ingestion</strong>. Accept conversion payloads with
            explicit CORS and Zod validation.
          </li>
          <li>
            <strong>Commission engine</strong>. Use idempotent writes and
            billing events to keep payout flows deterministic.
          </li>
          <li>
            <strong>Embedded dashboard</strong>. Review affiliate performance,
            recent conversions, and app settings inside Shopify Admin.
          </li>
        </ul>
      </div>
    </div>
  );
}
