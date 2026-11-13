///|
#derive(Eq, @debug.Debug)
pub(all) enum WidthStatus {
  Underflow
  Fits
  Overflow
}

///|
pub extend WidthStatus with Eq::{equal, not_equal}

///|
pub extend WidthStatus with @debug.Debug::{to_repr}

///|
pub suberror WidthCheckError {
  InvalidWidthLimits
}

///|
pub(all) struct WidthCheck {
  status : WidthStatus
  width : Double
  min_width : Double
  max_width : Double
  underflow_by : Double
  overflow_by : Double
}

///|
/// Inclusive width interval in pixels. Tolerance applies only to classification;
/// deviations retain their original subpixel values. No wrapping is performed.
pub fn check_text_width(
  width : Double,
  min_width : Double,
  max_width : Double,
  tolerance~ : Double = 0.01,
) -> WidthCheck raise WidthCheckError {
  if !width.is_finite() ||
    !min_width.is_finite() ||
    !max_width.is_finite() ||
    !tolerance.is_finite() ||
    width < 0.0 ||
    min_width < 0.0 ||
    max_width < min_width ||
    tolerance < 0.0 {
    raise InvalidWidthLimits
  }
  {
    status: if width < min_width - tolerance {
      Underflow
    } else if width > max_width + tolerance {
      Overflow
    } else {
      Fits
    },
    width,
    min_width,
    max_width,
    underflow_by: (min_width - width).max(0.0),
    overflow_by: (width - max_width).max(0.0),
  }
}

///|
pub fn TextBounds::check_width(
  self : TextBounds,
  min_width : Double,
  max_width : Double,
  tolerance~ : Double = 0.01,
) -> WidthCheck raise WidthCheckError {
  check_text_width(self.advance_width, min_width, max_width, tolerance~)
}
