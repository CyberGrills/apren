import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui.tsx';
import { PublicFooter, PublicHeader } from '../public/PublicShell.tsx';
export function HelpPage({ rules = false }: { rules?: boolean }) {
  return (
    <div className="public-page">
      <PublicHeader />
      <main id="main-content" className="public-container account-help">
        <PageHeader
          eyebrow={rules ? 'Booking and points' : 'A little help'}
          title={rules ? 'Know the details.' : 'Keep your plans on track.'}
          description="The useful things to know before and after a visit."
        />
        <div className="stack">
          {rules ? (
            <>
              <section className="panel">
                <h2>Before you reserve</h2>
                <p>
                  Choose your dates, sitting or experience, and the number of guests or rooms. The
                  quote shows the service price, discount, tax and total. A quote alone does not
                  reserve capacity.
                </p>
                <p>
                  When a hold is accepted, its expiry is shown. Complete checkout before that time.
                  A payment received after the hold expires needs review and does not restore the
                  reservation.
                </p>
              </section>
              <section className="panel">
                <h2>Payment and cancellation</h2>
                <p>
                  7even checkout is handled by Flutterwave. A successful payment and settlement to
                  the business’s bank are separate events. Check the current status in your
                  bookings.
                </p>
                <p>
                  Each place states its cancellation notice. The server checks the terms accepted
                  with your booking. Cancelling a booking and delivering a refund are separate
                  steps. Contact the business about a cancellation that is outside its notice
                  period.
                </p>
              </section>
              <section className="panel">
                <h2>Points and rewards</h2>
                <p>
                  Eligible points are issued after verified payment and completed service. Your
                  points history records earnings, redemptions and reversals. Points have no cash
                  withdrawal option.
                </p>
                <p>
                  Each participating business sets the points cost, capacity, expiry and terms of
                  its rewards. A refund can reverse earned points. If those points have already been
                  used, redemption pauses until the shortfall is covered by later earnings or
                  reviewed correction.
                </p>
              </section>
              <section className="panel">
                <h2>Giving and swapping benefits</h2>
                <p>
                  A benefit can be given or swapped only when its business permits transfer, it
                  remains unused and unexpired, and it is not already in another exchange. Both
                  sides must accept a swap. Booking rights cannot be transferred through an
                  exchange.
                </p>
                <p>
                  Keep redemption codes private. Acceptance changes ownership and invalidates the
                  previous owner’s code. The issuing business confirms use.
                </p>
              </section>
            </>
          ) : (
            <>
              <section className="panel">
                <h2>Find a booking</h2>
                <p>
                  Your bookings show the reservation, payment and settlement status separately. Keep
                  the booking reference handy when speaking to reception.
                </p>
                <Link className="text-button" to="/app/bookings">
                  Open your bookings
                </Link>
              </section>
              <section className="panel">
                <h2>Get into your account</h2>
                <p>
                  Use the email you gave reception or used when booking. If reception created the
                  account, a password reset link lets you claim it. Links work once and last 15
                  minutes.
                </p>
                <Link className="text-button" to="/forgot-password">
                  Request a reset link
                </Link>
              </section>
              <section className="panel">
                <h2>A payment needs attention</h2>
                <p>
                  A bank notification or checkout redirect does not confirm a booking. Open your
                  booking for the server-verified status. If it says review is needed, contact the
                  business with your booking and payment references. Avoid starting another payment
                  while an earlier one is uncertain.
                </p>
              </section>
              <section className="panel">
                <h2>At the reception desk</h2>
                <p>
                  Open the reception workspace on a supported desktop or tablet browser. The
                  browser’s install option adds 7even to the device. When offline, limited service
                  updates can be queued. New bookings, payment and reward use need a connection.
                </p>
                <Link className="text-button" to="/reception">
                  Open reception
                </Link>
              </section>
            </>
          )}
          <Link className="btn btn-secondary" to={rules ? '/help' : '/booking-rules'}>
            {rules ? 'Get help' : 'Read booking and points rules'}
          </Link>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
