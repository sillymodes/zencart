/**
 * ZenCart API Helper Module
 * Handles all communication with the Cloudflare Worker backend.
 */

const API_BASE = 'https://zencart-api.sillymodes.workers.dev';

/**
 * Generic fetch wrapper with error handling.
 * @param {string} path - API endpoint path
 * @param {object} options - fetch options
 * @returns {Promise<object>} parsed JSON response
 */
async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const defaults = {
    headers: {
      'Content-Type': 'application/json',
    },
  };
  const config = { ...defaults, ...options };
  if (options.headers) {
    config.headers = { ...defaults.headers, ...options.headers };
  }

  try {
    const response = await fetch(url, config);
    if (!response.ok) {
      const errorBody = await response.text();
      let errorMsg;
      try {
        const errorJson = JSON.parse(errorBody);
        errorMsg = errorJson.error || errorBody;
      } catch {
        errorMsg = errorBody;
      }
      throw new Error(`API error (${response.status}): ${errorMsg}`);
    }
    return await response.json();
  } catch (err) {
    if (err.message.startsWith('API error')) {
      throw err;
    }
    throw new Error(`Network error: Unable to reach the server. Please try again.`);
  }
}

/**
 * Submit quiz answers to the backend.
 * @param {object} answers - { pet_choice, color_choice, gender, age_group, stress_source, budget_tier }
 * @returns {Promise<object>} { session_id, recommendations }
 */
async function submitQuiz(answers) {
  return apiFetch('/submit-quiz', {
    method: 'POST',
    body: JSON.stringify(answers),
  });
}

/**
 * Get recommendations for a given session.
 * @param {string} sessionId
 * @returns {Promise<object>} { recommendations }
 */
async function getRecommendations(sessionId) {
  return apiFetch(`/recommendations?session=${encodeURIComponent(sessionId)}`);
}

/**
 * Submit a review.
 * @param {object} data - { stars, comment?, display_name?, session_id? }
 * @returns {Promise<object>} { success, id }
 */
async function submitReview(data) {
  return apiFetch('/review', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get paginated approved reviews.
 * @param {number} page - page number (1-indexed)
 * @returns {Promise<object>} { reviews, total, page, total_pages }
 */
async function getReviews(page = 1) {
  return apiFetch(`/reviews?page=${encodeURIComponent(page)}`);
}

/**
 * Log a page view.
 * @param {string} page - page identifier (e.g., 'home', 'quiz', 'results')
 * @returns {Promise<object>} { success }
 */
async function logPageview(page) {
  return apiFetch('/pageview', {
    method: 'POST',
    body: JSON.stringify({
      page: page,
      referrer: document.referrer || null,
    }),
  }).catch(() => {
    // Silently fail — pageview logging should never block the user experience
  });
}

/**
 * Get aggregated site statistics.
 * @returns {Promise<object>} stats object
 */
async function getStats() {
  return apiFetch('/stats');
}
