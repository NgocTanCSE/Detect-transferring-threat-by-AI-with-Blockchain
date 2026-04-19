"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Droplets,
  TrendingUp,
  import { redirect } from "next/navigation";

  export default function AdminDashboardLegacyRedirect() {
    redirect("/?role=system_admin&feature=0");
  }
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
