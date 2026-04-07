/**
 * ZenCart Quiz Flow
 * Single-page multi-step quiz on quiz.html.
 * Each question is a <section> shown/hidden by JS.
 */

(function () {
  'use strict';

  const TOTAL_STEPS = 6;
  let currentStep = 1;
  const answers = {};

  // DOM references
  const quizSteps = document.querySelectorAll('.quiz-step');
  const progressFill = document.getElementById('quiz-progress-fill');
  const progressText = document.getElementById('quiz-progress-text');
  const loadingEl = document.getElementById('quiz-loading');

  /**
   * Update the progress bar and step counter.
   */
  function updateProgress() {
    const pct = (currentStep / TOTAL_STEPS) * 100;
    if (progressFill) progressFill.style.width = pct + '%';
    if (progressText) progressText.textContent = `Question ${currentStep} of ${TOTAL_STEPS}`;
  }

  /**
   * Show the step section at the given index (1-based).
   */
  function showStep(step) {
    quizSteps.forEach(function (el) {
      el.classList.remove('active');
    });
    const target = document.getElementById('step-' + step);
    if (target) {
      target.classList.add('active');
    }
    currentStep = step;
    updateProgress();

    // Hide back button on first step
    var backBtns = document.querySelectorAll('.quiz-back');
    backBtns.forEach(function (btn) {
      btn.style.display = step === 1 ? 'none' : 'inline-flex';
    });
  }

  /**
   * Handle selecting an answer for a step.
   */
  function selectAnswer(step, key, value) {
    answers[key] = value;

    // Mark as selected visually
    var stepEl = document.getElementById('step-' + step);
    if (stepEl) {
      var options = stepEl.querySelectorAll('.quiz-option, .color-swatch');
      options.forEach(function (opt) {
        opt.classList.remove('selected');
      });
      var selected = stepEl.querySelector('[data-value="' + CSS.escape(value) + '"]');
      if (selected) selected.classList.add('selected');
    }

    // Auto-advance after a brief delay for visual feedback
    if (step < TOTAL_STEPS) {
      setTimeout(function () {
        showStep(step + 1);
      }, 250);
    } else {
      // Final step — submit quiz
      submitQuizAnswers();
    }
  }

  /**
   * Go back one step.
   */
  function goBack() {
    if (currentStep > 1) {
      showStep(currentStep - 1);
    }
  }

  /**
   * Submit quiz answers to the API and redirect to results.
   */
  async function submitQuizAnswers() {
    // Show loading state
    quizSteps.forEach(function (el) {
      el.classList.remove('active');
    });
    if (loadingEl) loadingEl.classList.add('active');

    var payload = {
      pet_choice: answers.pet_choice || '',
      color_choice: answers.color_choice || '',
      gender: answers.gender || '',
      age_group: answers.age_group || '',
      stress_source: answers.stress_source || '',
      budget_tier: answers.budget_tier || '',
    };

    try {
      var result = await submitQuiz(payload);
      if (result && result.session_id) {
        sessionStorage.setItem('zencart_session_id', result.session_id);
        window.location.href = '/zencart/results.html';
      } else {
        showError('Something went wrong. Please try again.');
      }
    } catch (err) {
      console.error('Quiz submission error:', err);
      showError('Unable to submit your answers right now. Please try again in a moment.');
    }
  }

  /**
   * Show an error message in the loading area.
   */
  function showError(msg) {
    if (loadingEl) {
      loadingEl.innerHTML =
        '<div class="error-state">' +
        '<div class="error-icon">&#x1F343;</div>' +
        '<p>' + msg + '</p>' +
        '<button class="btn btn-outline" onclick="location.reload()">Try Again</button>' +
        '</div>';
      loadingEl.classList.add('active');
    }
  }

  /**
   * Initialize quiz event listeners.
   */
  function init() {
    // Text-based options (Steps 1, 3, 4, 5, 6)
    document.querySelectorAll('.quiz-option').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var step = parseInt(this.closest('.quiz-step').id.replace('step-', ''), 10);
        var key = this.closest('.quiz-step').dataset.key;
        var value = this.dataset.value;
        selectAnswer(step, key, value);
      });
    });

    // Color swatch options (Step 2)
    document.querySelectorAll('.color-swatch').forEach(function (swatch) {
      swatch.addEventListener('click', function () {
        var step = parseInt(this.closest('.quiz-step').id.replace('step-', ''), 10);
        var key = this.closest('.quiz-step').dataset.key;
        var value = this.dataset.value;
        selectAnswer(step, key, value);
      });
    });

    // Back buttons
    document.querySelectorAll('.quiz-back').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        goBack();
      });
    });

    // Keyboard support for swatches
    document.querySelectorAll('.color-swatch').forEach(function (swatch) {
      swatch.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.click();
        }
      });
    });

    // Start at step 1
    showStep(1);

    // Log pageview
    if (typeof logPageview === 'function') {
      logPageview('quiz');
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
