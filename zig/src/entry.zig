//! The program every hook binary starts in. `addHooks` builds this file as the
//! root of the executable, size-optimized, with the author's hook and the
//! library beside it as modules that keep their safety checks.
//!
//! Zig compiles the standard library in the root module's mode, and the
//! standard library is most of a hook's size. So the split gives a binary the
//! size of an unchecked build in which a bug in the hook or the library still
//! panics, and the panic still follows the entry's fail policy.

const std = @import("std");
const hook = @import("hook");
const user = @import("user");

/// Installed here, so every hook gets it whether or not its own file declares it.
pub const panic = hook.panic;

pub fn main(init: std.process.Init) void {
    user.main(init);
}
