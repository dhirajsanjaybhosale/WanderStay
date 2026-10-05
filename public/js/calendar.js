/**
 * WanderStay — Luxury Availability Calendar Client Logic
 */
(function () {
  function initWanderCalendar() {
    const calendarEl = document.getElementById("wander-calendar");
    if (!calendarEl) return;

    const checkInInput = document.getElementById("checkInDate");
    const checkOutInput = document.getElementById("checkOutDate");
    const guestsSelect = document.getElementById("bookingGuests");
    const statusBar = document.getElementById("cal-status-text");
    const clearBtn = document.getElementById("cal-clear-btn");
    const prevBtn = document.getElementById("cal-prev-btn");
    const nextBtn = document.getElementById("cal-next-btn");
    const monthTitle = document.getElementById("cal-month-title");
    const gridEl = document.getElementById("cal-grid");

    const rawData = window.availabilityData || {};
    const bookedRanges = (rawData.bookedRanges || []).map((r) => ({
      start: normalizeDate(new Date(r.checkIn)),
      end: normalizeDate(new Date(r.checkOut)),
    }));

    const blockedRanges = (rawData.blockedRanges || []).map((b) => ({
      start: normalizeDate(new Date(b.startDate)),
      end: normalizeDate(new Date(b.endDate)),
      reason: b.reason || "Blocked by host",
    }));

    const today = normalizeDate(new Date());
    let viewYear = today.getFullYear();
    let viewMonth = today.getMonth();

    let selectedCheckIn = checkInInput && checkInInput.value ? normalizeDate(new Date(checkInInput.value)) : null;
    let selectedCheckOut = checkOutInput && checkOutInput.value ? normalizeDate(new Date(checkOutInput.value)) : null;

    // Verify initial values if any are preselected
    if (selectedCheckIn && (isBooked(selectedCheckIn) || isBlocked(selectedCheckIn) || selectedCheckIn < today)) {
      selectedCheckIn = null;
      selectedCheckOut = null;
      if (checkInInput) checkInInput.value = "";
      if (checkOutInput) checkOutInput.value = "";
    }

    let hoverDate = null;

    function normalizeDate(d) {
      const copy = new Date(d);
      copy.setHours(0, 0, 0, 0);
      return copy;
    }

    function formatDateISO(d) {
      if (!d) return "";
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    function formatDisplayDate(d) {
      if (!d) return "";
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }

    function isSameDay(d1, d2) {
      if (!d1 || !d2) return false;
      return (
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate()
      );
    }

    function isPast(d) {
      return d < today;
    }

    function isBooked(d) {
      return bookedRanges.some((r) => d >= r.start && d < r.end);
    }

    function isBlocked(d) {
      return blockedRanges.some((b) => d >= b.start && d < b.end);
    }

    function isAvailable(d) {
      return !isPast(d) && !isBooked(d) && !isBlocked(d);
    }

    function isRangeValid(start, end) {
      if (!start || !end || end <= start) return false;
      let curr = new Date(start);
      while (curr < end) {
        if (!isAvailable(curr)) {
          return false;
        }
        curr.setDate(curr.getDate() + 1);
      }
      return true;
    }

    function updateFormAndUI() {
      if (checkInInput) checkInInput.value = formatDateISO(selectedCheckIn);
      if (checkOutInput) checkOutInput.value = formatDateISO(selectedCheckOut);

      if (selectedCheckIn && selectedCheckOut) {
        const nights = Math.round((selectedCheckOut - selectedCheckIn) / (1000 * 60 * 60 * 24));
        if (statusBar) {
          statusBar.innerHTML = `<span class="text-primary fw-bold">${nights} ${nights === 1 ? "night" : "nights"}</span>: ${formatDisplayDate(selectedCheckIn)} &rarr; ${formatDisplayDate(selectedCheckOut)}`;
        }
        if (clearBtn) clearBtn.style.display = "inline-block";
      } else if (selectedCheckIn) {
        if (statusBar) {
          statusBar.innerHTML = `Check-in: <span class="text-primary fw-bold">${formatDisplayDate(selectedCheckIn)}</span>. Please select check-out.`;
        }
        if (clearBtn) clearBtn.style.display = "inline-block";
      } else {
        if (statusBar) {
          statusBar.textContent = "Select check-in & check-out dates on the calendar";
        }
        if (clearBtn) clearBtn.style.display = "none";
      }

      // Trigger existing price calculator if defined
      if (typeof window.wanderUpdatePrice === "function") {
        window.wanderUpdatePrice();
      }
    }

    function renderCalendar() {
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      if (monthTitle) {
        monthTitle.textContent = `${monthNames[viewMonth]} ${viewYear}`;
      }

      // Check if prev button should be disabled (cannot go earlier than current month)
      if (prevBtn) {
        const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();
        prevBtn.disabled = isCurrentMonth;
      }

      if (!gridEl) return;
      gridEl.innerHTML = "";

      const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
      const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

      // Empty lead cells
      for (let i = 0; i < firstDayIndex; i++) {
        const emptyCell = document.createElement("div");
        emptyCell.className = "cal-cell empty";
        gridEl.appendChild(emptyCell);
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(viewYear, viewMonth, day);
        const normDate = normalizeDate(date);

        const cell = document.createElement("div");
        cell.className = "cal-cell";

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cal-day-btn";
        btn.textContent = day;
        btn.setAttribute("data-date", formatDateISO(normDate));

        if (isSameDay(normDate, today)) {
          btn.classList.add("is-today");
        }

        const past = isPast(normDate);
        const booked = isBooked(normDate);
        const blocked = isBlocked(normDate);

        if (past) {
          cell.classList.add("past");
          btn.disabled = true;
          btn.title = "Past date";
        } else if (booked) {
          cell.classList.add("booked");
          btn.disabled = true;
          btn.title = "Already booked";
        } else if (blocked) {
          cell.classList.add("blocked");
          btn.disabled = true;
          const blockInfo = blockedRanges.find((b) => normDate >= b.start && normDate < b.end);
          btn.title = blockInfo ? `Blocked: ${blockInfo.reason}` : "Blocked by host";
        } else {
          cell.classList.add("available");
          btn.title = "Available";
        }

        // Highlight selected range
        if (selectedCheckIn && isSameDay(normDate, selectedCheckIn)) {
          cell.classList.add("range-start");
        }
        if (selectedCheckOut && isSameDay(normDate, selectedCheckOut)) {
          cell.classList.add("range-end");
        }
        if (selectedCheckIn && selectedCheckOut && normDate > selectedCheckIn && normDate < selectedCheckOut) {
          cell.classList.add("in-range");
        }

        // Hover range preview when start date is picked
        if (selectedCheckIn && !selectedCheckOut && hoverDate && hoverDate > selectedCheckIn) {
          if (normDate > selectedCheckIn && normDate < hoverDate) {
            cell.classList.add("hover-range");
          }
        }

        // Date selection click handler
        btn.addEventListener("click", () => {
          if (past || booked || blocked) return;

          if (!selectedCheckIn || (selectedCheckIn && selectedCheckOut)) {
            // New selection cycle
            selectedCheckIn = normDate;
            selectedCheckOut = null;
            updateFormAndUI();
            renderCalendar();
          } else if (selectedCheckIn && !selectedCheckOut) {
            if (normDate <= selectedCheckIn) {
              // Clicked date is earlier or same as check-in: reset check-in to this date
              selectedCheckIn = normDate;
              selectedCheckOut = null;
              updateFormAndUI();
              renderCalendar();
            } else {
              // Validate all dates in between
              if (isRangeValid(selectedCheckIn, normDate)) {
                selectedCheckOut = normDate;
                updateFormAndUI();
                renderCalendar();
              } else {
                showCalendarAlert("The selected range includes dates that are already booked or blocked. Please choose an available continuous range.");
              }
            }
          }
        });

        // Hover preview
        btn.addEventListener("mouseenter", () => {
          if (selectedCheckIn && !selectedCheckOut && isAvailable(normDate) && normDate > selectedCheckIn) {
            hoverDate = normDate;
            renderHoverRange();
          }
        });

        cell.appendChild(btn);
        gridEl.appendChild(cell);
      }
    }

    function renderHoverRange() {
      if (!selectedCheckIn || selectedCheckOut || !hoverDate) return;
      const cells = gridEl.querySelectorAll(".cal-cell");
      cells.forEach((cell) => {
        const btn = cell.querySelector(".cal-day-btn");
        if (!btn || !btn.dataset.date) return;
        const d = normalizeDate(new Date(btn.dataset.date));
        if (d > selectedCheckIn && d < hoverDate && isRangeValid(selectedCheckIn, hoverDate)) {
          cell.classList.add("hover-range");
        } else {
          cell.classList.remove("hover-range");
        }
      });
    }

    function showCalendarAlert(msg) {
      if (statusBar) {
        const original = statusBar.innerHTML;
        statusBar.innerHTML = `<span class="text-danger fw-bold"><i class="fa-solid fa-triangle-exclamation me-1"></i> ${msg}</span>`;
        setTimeout(() => {
          updateFormAndUI();
        }, 4000);
      }
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        selectedCheckIn = null;
        selectedCheckOut = null;
        hoverDate = null;
        updateFormAndUI();
        renderCalendar();
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        viewMonth--;
        if (viewMonth < 0) {
          viewMonth = 11;
          viewYear--;
        }
        renderCalendar();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        viewMonth++;
        if (viewMonth > 11) {
          viewMonth = 0;
          viewYear++;
        }
        renderCalendar();
      });
    }

    // Auto-select first available 3-night block if input dates are empty or invalid
    if (!selectedCheckIn || !selectedCheckOut) {
      let candidateStart = new Date(today);
      candidateStart.setDate(candidateStart.getDate() + 1);
      for (let d = 0; d < 60; d++) {
        const s = normalizeDate(candidateStart);
        const e = normalizeDate(new Date(candidateStart));
        e.setDate(e.getDate() + 3);
        if (isRangeValid(s, e)) {
          selectedCheckIn = s;
          selectedCheckOut = e;
          // Sync view month with selected check-in
          viewMonth = selectedCheckIn.getMonth();
          viewYear = selectedCheckIn.getFullYear();
          break;
        }
        candidateStart.setDate(candidateStart.getDate() + 1);
      }
    }

    updateFormAndUI();
    renderCalendar();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initWanderCalendar);
  } else {
    initWanderCalendar();
  }
})();
