const axios = require('axios');

const {
  CLOUDFLARE_API_TOKEN,
  CLOUDFLARE_ZONE_ID,
} = process.env;

if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ZONE_ID) {
  console.warn('[Metrics] Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID env var. Metrics endpoint will fail until set.');
}

const CLOUDFLARE_GRAPHQL_ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';

const formatDate = (date) => date.toISOString().split('T')[0];

/**
 * Fetch Cloudflare analytics via GraphQL for the past 30 days.
 * Docs: https://developers.cloudflare.com/analytics/graphql-api/
 */
exports.getMetrics = async (req, res) => {
  try {
    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ZONE_ID) {
      return res.status(500).json({
        message: 'Cloudflare credentials are not configured. Please set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID.',
      });
    }

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 30);

    const query = `
      query ($zoneTag: String!, $start: Date!, $end: Date!) {
        viewer {
          zones(filter: {zoneTag: $zoneTag}) {
            httpRequests1dGroups(
              limit: 1000
              filter: {date_geq: $start, date_leq: $end}
            ) {
              dimensions {
                date
              }
              sum {
                requests
              }
              uniq {
                uniques
              }
            }
          }
        }
      }
    `;

    const variables = {
      zoneTag: CLOUDFLARE_ZONE_ID,
      start: formatDate(startDate),
      end: formatDate(endDate),
    };

    const response = await axios.post(
      CLOUDFLARE_GRAPHQL_ENDPOINT,
      { query, variables },
      {
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
      }
    );

    const groups = response.data?.data?.viewer?.zones?.[0]?.httpRequests1dGroups;
    if (!groups) {
      return res.status(502).json({
        message: 'Invalid response from Cloudflare GraphQL API',
        raw: response.data,
      });
    }

    const totals = groups.reduce(
      (acc, group) => {
        acc.totalRequests += group?.sum?.requests || 0;
        acc.uniqueVisitors += group?.uniq?.uniques || 0;
        return acc;
      },
      { totalRequests: 0, uniqueVisitors: 0 }
    );

    return res.json({
      totalRequests: totals.totalRequests,
      uniqueVisitors: totals.uniqueVisitors,
      range: {
        start: variables.start,
        end: variables.end,
      },
    });
  } catch (error) {
    console.error('[Metrics] Failed to fetch Cloudflare analytics:', error?.response?.data || error.message);
    const status = error.response?.status || 500;
    return res.status(status).json({
      message: 'Failed to fetch Cloudflare metrics',
      error: error.response?.data || error.message,
    });
  }
};

