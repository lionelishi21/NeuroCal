"use client";

import Link from "next/link";
import { useAdminProducts, useAdminWaitlist } from "../api/queries";
import { AdminCard, AdminShell, Stat } from "../components/AdminShell";
import { EmptyState, LoadFailed, LoadingLines } from "../components/ListStates";
import { WaitlistTable } from "./AdminWaitlist";

const cardLink =
  "text-sm font-bold text-synapse-ink no-underline underline-offset-4 hover:underline";

/** Where admins land after signing in: the waitlist and the product catalog at a glance. */
export function AdminDashboard() {
  const waitlist = useAdminWaitlist();
  const products = useAdminProducts();
  const all = products.data?.products ?? [];
  const off = all.filter((p) => !p.enabled).length;

  return (
    <AdminShell
      title="Overview"
      detail="The waitlist and the products NeuroCal suggests."
    >
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat
            label="On the waitlist"
            value={waitlist.data ? waitlist.data.total : "–"}
            note={
              waitlist.data &&
              `${waitlist.data.iphone} iPhone · ${waitlist.data.android} Android`
            }
          />
          <Stat
            label="Joined this week"
            value={waitlist.data ? waitlist.data.thisWeek : "–"}
            note="Last seven days"
          />
          <Stat
            label="Products"
            value={products.data ? all.length - off : "–"}
            note={
              products.data && (off ? `${off} turned off` : "All turned on")
            }
          />
          <Stat
            label="Affiliate links"
            value={products.data ? all.filter((p) => p.affiliate).length : "–"}
            note={
              products.data &&
              `${all.filter((p) => p.ownBrand).length} of our own brand`
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <AdminCard
            title="Newest sign-ups"
            action={
              <Link href="/admin/waitlist" className={cardLink}>
                See all
              </Link>
            }
          >
            {waitlist.isPending && (
              <LoadingLines label="Loading the waitlist" lines={4} />
            )}
            {waitlist.isError && (
              <LoadFailed
                title="Couldn't load the waitlist"
                onRetry={() => waitlist.refetch()}
              >
                Check your connection and try again.
              </LoadFailed>
            )}
            {waitlist.data &&
              (waitlist.data.entries.length ? (
                <WaitlistTable entries={waitlist.data.entries.slice(0, 6)} />
              ) : (
                <EmptyState title="No one yet">
                  Sign-ups from the landing page show up here.
                </EmptyState>
              ))}
          </AdminCard>

          <div className="flex flex-col gap-6">
            <AdminCard
              title="Products"
              action={
                <Link href="/admin/products" className={cardLink}>
                  Manage
                </Link>
              }
            >
              <p className="m-0 text-sm text-pretty text-ink-soft">
                Swap a product&rsquo;s link, mark it as an affiliate link, turn
                it off, or add one that isn&rsquo;t in the catalog.
              </p>
            </AdminCard>
            <AdminCard
              title="App preview"
              action={
                <Link href="/app" className={cardLink}>
                  Open
                </Link>
              }
            >
              <p className="m-0 text-sm text-pretty text-ink-soft">
                The app&rsquo;s screens on sample data, to check them before
                they reach the mobile app.
              </p>
            </AdminCard>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
